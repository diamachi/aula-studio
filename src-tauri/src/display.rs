use hidapi::{HidApi, HidDevice};
use image::{AnimationDecoder, DynamicImage, ImageDecoder, ImageFormat, ImageReader, Rgba, RgbaImage};
use serde::{Deserialize, Serialize};
use std::io::{BufReader, Cursor};
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};
use tauri::{State, ipc::Channel};

const WIDTH: u32 = 128;
const FRAME_BYTES: usize = 128 * 128 * 2;
const CHUNK: usize = 4096;
const MAX_FRAMES: usize = 255; // F75 Max vendor layout, not another model's limit.
const MAX_INPUT: usize = 16 * 1024 * 1024;

#[derive(Default, Clone)]
pub struct DisplayState { cached: Arc<Mutex<Option<Prepared>>>, generation: Arc<AtomicU64> }
struct Prepared { id: u64, stream: Vec<u8> }
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct Preview { id: String, frames: usize, chunks: usize, duration_ms: u32, pixels: Vec<u8> }
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct WiredStatus { pub connected: bool, pub display_available: bool, pub message: String }
#[derive(Clone, Serialize)]
#[serde(rename_all="camelCase")]
pub struct Progress { sent: usize, total: usize }
#[derive(Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
pub struct Clock { year: u16, month: u8, day: u8, hour: u8, minute: u8, second: u8, weekday: u8 }

fn limits() -> image::Limits {
    let mut limits=image::Limits::default();
    limits.max_image_width=Some(4096); limits.max_image_height=Some(4096);
    limits.max_alloc=Some(128*1024*1024); limits
}
fn render(source: RgbaImage, fit: &str) -> RgbaImage {
    let image=DynamicImage::ImageRgba8(source);
    let resized=match fit {
        "fill"=>image.resize_to_fill(WIDTH,WIDTH,image::imageops::FilterType::Lanczos3),
        "stretch"=>image.resize_exact(WIDTH,WIDTH,image::imageops::FilterType::Lanczos3),
        _=>image.resize(WIDTH,WIDTH,image::imageops::FilterType::Lanczos3),
    }.to_rgba8();
    let mut canvas=RgbaImage::from_pixel(WIDTH,WIDTH,Rgba([0,0,0,255]));
    image::imageops::overlay(&mut canvas,&resized,((WIDTH-resized.width())/2) as i64,((WIDTH-resized.height())/2) as i64);
    canvas
}
fn append_frame(stream: &mut Vec<u8>, delays: &mut Vec<u8>, image: RgbaImage, ms: f64, fit: &str, preview: &mut Vec<u8>) -> Result<(),String> {
    if delays.len()>=MAX_FRAMES { return Err("This GIF exceeds the F75 Max limit of 255 frames. Export a shorter animation.".into()); }
    let canvas=render(image,fit);
    if preview.is_empty() { *preview=canvas.clone().into_raw(); }
    delays.push((ms.max(2.0)/2.0).round().clamp(1.0,255.0) as u8);
    for p in canvas.pixels() {
        let value=((p[0] as u16>>3)<<11)|((p[1] as u16>>2)<<5)|(p[2] as u16>>3);
        stream.extend_from_slice(&value.to_le_bytes());
    }
    Ok(())
}
fn encode(bytes: &[u8], fit: &str, id: u64) -> Result<(Prepared,Preview),String> {
    if bytes.is_empty() || bytes.len()>MAX_INPUT { return Err("Choose a PNG, JPEG or GIF up to 16 MB.".into()); }
    if !["fit","fill","stretch"].contains(&fit) { return Err("Unknown image fit mode".into()); }
    let format=image::guess_format(bytes).map_err(|e|e.to_string())?;
    let mut stream=vec![0u8;256]; let mut delays=Vec::new(); let mut pixels=Vec::new();
    if format==ImageFormat::Gif {
        let mut decoder=image::codecs::gif::GifDecoder::new(BufReader::new(Cursor::new(bytes))).map_err(|e|e.to_string())?;
        decoder.set_limits(limits()).map_err(|e|e.to_string())?;
        for frame in decoder.into_frames() {
            let frame=frame.map_err(|e|e.to_string())?;
            let (n,d)=frame.delay().numer_denom_ms();
            let ms=if n==0 || d==0 {100.0} else {n as f64/d as f64};
            append_frame(&mut stream,&mut delays,frame.into_buffer(),ms,fit,&mut pixels)?;
        }
    } else if format==ImageFormat::Png || format==ImageFormat::Jpeg {
        let mut reader=ImageReader::with_format(Cursor::new(bytes),format); reader.limits(limits());
        let mut decoder=reader.into_decoder().map_err(|e|e.to_string())?;
        let orientation=decoder.orientation().map_err(|e|e.to_string())?;
        let mut image=DynamicImage::from_decoder(decoder).map_err(|e|e.to_string())?;
        image.apply_orientation(orientation);
        append_frame(&mut stream,&mut delays,image.to_rgba8(),100.0,fit,&mut pixels)?;
    } else { return Err("Supported formats: PNG, JPEG and GIF.".into()); }
    if delays.is_empty() {return Err("The image contains no frames".into());}
    stream[0]=delays.len() as u8;
    stream[1..1+delays.len()].copy_from_slice(&delays);
    let chunks=stream.len().div_ceil(CHUNK);stream.resize(chunks*CHUNK,0);
    let preview=Preview{id:id.to_string(),frames:delays.len(),chunks,duration_ms:delays.iter().map(|d|*d as u32*2).sum(),pixels};
    Ok((Prepared{id,stream},preview))
}

fn endpoints(api: &HidApi) -> Result<(Vec<u8>,Option<Vec<u8>>),String> {
    let commands:Vec<_>=api.device_list().filter(|d|d.vendor_id()==0x0c45 && d.product_id()==0x800a && d.usage_page()==0xff13).collect();
    let raw:Vec<_>=api.device_list().filter(|d|d.vendor_id()==0x0c45 && d.product_id()==0x800a && d.usage_page()==0xff68).collect();
    if commands.len()!=1 || raw.len()>1 { return Err(if commands.is_empty(){"Connect the F75 Max with a USB data cable and select wired mode."}else{"Connect only one F75 Max by USB to avoid mixing display endpoints."}.into()); }
    Ok((commands[0].path().to_bytes_with_nul().to_vec(),raw.first().map(|d|d.path().to_bytes_with_nul().to_vec())))
}
fn open_path(api: &HidApi,path: &[u8])->Result<HidDevice,String> {
    api.open_path(std::ffi::CStr::from_bytes_with_nul(path).map_err(|e|e.to_string())?).map_err(|e|e.to_string())
}
fn command(op:u8)->[u8;64] {let mut p=[0u8;64];p[0]=4;p[1]=op;p}
fn exchange(device:&HidDevice,body:&[u8;64])->Result<(),String> {
    let mut report=[0u8;65];report[1..].copy_from_slice(body);
    device.send_feature_report(&report).map_err(|e|e.to_string())?;
    let mut last=Vec::new();
    for _ in 0..6 {
        std::thread::sleep(Duration::from_millis(50));
        let mut reply=[0u8;65];
        let length=device.get_feature_report(&mut reply).map_err(|e|e.to_string())?;
        let reply=&reply[..length];
        let data=if reply.len()==65 && reply.first()==Some(&0){&reply[1..]}else{reply};
        if body[0]==4 && data.len()>=4 && data[..2]==body[..2] && data[3]==1{return Ok(());}
        if body[0]!=4 && data.len()>=12 && data[..12]==body[..12]{return Ok(());}
        last=data.to_vec();
    }
    Err(format!("Display command {:02X}/{:02X} not acknowledged (reply {:02X?})",body[0],body[1],&last[..last.len().min(8)]))
}

#[tauri::command]
pub async fn scan_display()->Result<WiredStatus,String> {
    tauri::async_runtime::spawn_blocking(||{
        let _guard=crate::HID_LOCK.lock().map_err(|e|e.to_string())?;
        let api=HidApi::new().map_err(|e|e.to_string())?;
        Ok(match endpoints(&api){Ok((_,raw))=>WiredStatus{connected:true,display_available:raw.is_some(),message:if raw.is_some(){"Wired display ready"}else{"Clock channel ready; display endpoint missing"}.into()},Err(message)=>WiredStatus{connected:false,display_available:false,message}})
    }).await.map_err(|e|e.to_string())?
}
#[tauri::command]
pub async fn prepare_display(bytes:Vec<u8>,fit:String,state:State<'_,DisplayState>)->Result<Preview,String> {
    let id=state.generation.fetch_add(1,Ordering::SeqCst)+1;let state=state.inner().clone();
    tauri::async_runtime::spawn_blocking(move||{
        let (prepared,preview)=encode(&bytes,&fit,id)?;
        if state.generation.load(Ordering::SeqCst)!=id{return Err("A newer preview is being prepared".into());}
        *state.cached.lock().map_err(|e|e.to_string())?=Some(prepared);Ok(preview)
    }).await.map_err(|e|e.to_string())?
}
#[tauri::command]
pub async fn upload_display(id:String,on_progress:Channel<Progress>,state:State<'_,DisplayState>)->Result<(),String> {
    let id=id.parse::<u64>().map_err(|_|"Invalid preview ID")?;
    let state=state.inner().clone();
    tauri::async_runtime::spawn_blocking(move||{
        let stream={let cache=state.cached.lock().map_err(|e|e.to_string())?;let p=cache.as_ref().filter(|p|p.id==id).ok_or("Prepare the current image before uploading")?;p.stream.clone()};
        validate_stream(&stream)?;
        let _guard=crate::HID_LOCK.lock().map_err(|e|e.to_string())?;
        let api=HidApi::new().map_err(|e|e.to_string())?;let (cmd,raw)=endpoints(&api)?;
        let raw=raw.ok_or("The wired display endpoint is missing")?;
        let control=open_path(&api,&cmd)?;let display=open_path(&api,&raw)?;
        exchange(&control,&command(0x18))?;
        let mut header=command(0x72);header[2]=1;let count=(stream.len()/CHUNK) as u16;header[8..10].copy_from_slice(&count.to_le_bytes());
        exchange(&control,&header)?;
        let mut ack=[0u8;512];
        // Drain metadata input; each following chunk is paced by fresh input.
        for _ in 0..16{if display.read_timeout(&mut ack,1).map_err(|e|e.to_string())?==0{break;}}
        for (index,chunk) in stream.chunks_exact(CHUNK).enumerate(){
            let mut report=Vec::with_capacity(CHUNK+1);report.push(0);report.extend_from_slice(chunk);
            if display.write(&report).map_err(|e|e.to_string())?!=report.len(){return Err(format!("Incomplete image chunk {}",index+1));}
            let deadline=Instant::now()+Duration::from_millis(750);let mut acknowledged=false;
            while Instant::now()<deadline{if display.read_timeout(&mut ack,50).map_err(|e|e.to_string())?>0{acknowledged=true;break;}}
            if !acknowledged{return Err(format!("No display acknowledgment after chunk {}/{}. Upload stopped; reconnect before retrying.",index+1,count));}
            on_progress.send(Progress{sent:index+1,total:count as usize}).map_err(|e|e.to_string())?;
        }
        exchange(&control,&command(2))?;Ok(())
    }).await.map_err(|e|e.to_string())?
}
fn validate_stream(stream:&[u8])->Result<(),String>{
    if stream.len()<CHUNK || stream.len()%CHUNK!=0{return Err("Invalid display stream alignment".into());}
    let frames=stream[0] as usize;
    if frames==0 || frames>MAX_FRAMES || (256+frames*FRAME_BYTES).div_ceil(CHUNK)*CHUNK!=stream.len(){return Err("Invalid display stream frame count".into());}
    if stream[1..1+frames].contains(&0){return Err("Invalid display frame delay".into());}Ok(())
}
fn clock_packet(time:&Clock)->Result<[u8;64],String>{
    let leap=time.year%4==0 && (time.year%100!=0 || time.year%400==0);
    let days=match time.month{2=>if leap{29}else{28},4|6|9|11=>30,1|3|5|7|8|10|12=>31,_=>0};
    if !(2000..=2099).contains(&time.year)||time.day==0||time.day>days||time.hour>23||time.minute>59||time.second>59||time.weekday>6{return Err("Invalid clock date or time".into());}
    let mut p=[0u8;64];p[1]=1;p[2]=0x5a;p[3]=(time.year-2000) as u8;p[4]=time.month;p[5]=time.day;p[6]=time.hour;p[7]=time.minute;p[8]=time.second;p[10]=time.weekday;p[62..].copy_from_slice(&[0xaa,0x55]);Ok(p)
}
#[tauri::command]
pub async fn sync_display_clock(time:Clock)->Result<(),String>{
    let packet=clock_packet(&time)?;
    tauri::async_runtime::spawn_blocking(move||{let _guard=crate::HID_LOCK.lock().map_err(|e|e.to_string())?;let api=HidApi::new().map_err(|e|e.to_string())?;let(cmd,_)=endpoints(&api)?;let device=open_path(&api,&cmd)?;exchange(&device,&command(0x18))?;let mut prepare=command(0x28);prepare[8]=1;exchange(&device,&prepare)?;exchange(&device,&packet)?;exchange(&device,&command(2))}).await.map_err(|e|e.to_string())?
}

#[cfg(test)]mod tests{
    use super::*;
    #[test]fn gif_timing_and_frame_limit(){
        let mut bytes=Vec::new();
        {let mut encoder=image::codecs::gif::GifEncoder::new(&mut bytes);
        for ms in [40,800]{encoder.encode_frame(image::Frame::from_parts(RgbaImage::from_pixel(2,2,Rgba([0,255,0,255])),0,0,image::Delay::from_numer_denom_ms(ms,1))).unwrap();}}
        let(p,v)=encode(&bytes,"fill",2).unwrap();assert_eq!(v.frames,2);assert_eq!(&p.stream[..3],&[2,20,255]);assert_eq!(v.duration_ms,550);validate_stream(&p.stream).unwrap();
        let mut delays=vec![1;255];assert!(append_frame(&mut Vec::new(),&mut delays,RgbaImage::new(1,1),20.0,"fit",&mut Vec::new()).is_err());
    }
    #[test]fn rgb565_and_alignment(){let image=RgbaImage::from_pixel(128,128,Rgba([255,0,0,255]));let mut bytes=Cursor::new(Vec::new());DynamicImage::ImageRgba8(image).write_to(&mut bytes,ImageFormat::Png).unwrap();let(p,v)=encode(bytes.get_ref(),"fit",1).unwrap();assert_eq!(v.frames,1);assert_eq!(v.chunks,9);assert_eq!(&p.stream[256..258],&[0,0xf8]);validate_stream(&p.stream).unwrap();}
    #[test]fn fit_letterboxes_and_alpha_black(){let wide=RgbaImage::from_pixel(256,128,Rgba([255,255,255,255]));let result=render(wide,"fit");assert_eq!(result.get_pixel(64,0).0,[0,0,0,255]);assert_eq!(result.get_pixel(64,64).0,[255,255,255,255]);let alpha=render(RgbaImage::from_pixel(2,2,Rgba([255,0,0,0])),"stretch");assert_eq!(alpha.get_pixel(64,64).0,[0,0,0,255]);}
    #[test]fn bounds_and_clock(){assert!(encode(&[],"fit",1).is_err());assert!(validate_stream(&vec![0;4096]).is_err());let t=Clock{year:2026,month:10,day:31,hour:12,minute:34,second:56,weekday:6};assert_eq!(&clock_packet(&t).unwrap()[1..9],&[1,0x5a,26,10,31,12,34,56]);let bad=Clock{month:2,day:30,..t};assert!(clock_packet(&bad).is_err());}
}
