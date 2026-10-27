import Foundation
import AppKit
import AVFoundation
import CoreText
import ImageIO
import UniformTypeIdentifiers
let out = CommandLine.arguments[1]
let source = CommandLine.arguments[2]
let W = 600, H = 800, fps = 60
let image = NSImage(contentsOfFile: source)!.cgImage(forProposedRect: nil, context: nil, hints: nil)!
let url = URL(fileURLWithPath: out + "/cereva-intro.mp4")
try? FileManager.default.removeItem(at: url)
let writer = try AVAssetWriter(outputURL: url, fileType: .mp4)
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: W, AVVideoHeightKey: H, AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 6000000, AVVideoExpectedSourceFrameRateKey: fps, AVVideoMaxKeyFrameIntervalKey: fps]])
let adapter = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB, kCVPixelBufferWidthKey as String: W, kCVPixelBufferHeightKey as String: H, kCVPixelBufferCGImageCompatibilityKey as String: true, kCVPixelBufferCGBitmapContextCompatibilityKey as String: true])
writer.add(input); writer.startWriting(); writer.startSession(atSourceTime: .zero)
func ease(_ v: Double) -> Double { let x = min(1,max(0,v)); return x*x*x*(x*(x*6-15)+10) }
func text(_ s: String, _ size: CGFloat, _ y: CGFloat, _ alpha: CGFloat, _ ctx: CGContext) {
 let font = CTFontCreateWithName("AvenirNext-Medium" as CFString, size, nil)
 let str = NSAttributedString(string:s, attributes:[NSAttributedString.Key(kCTFontAttributeName as String):font, NSAttributedString.Key(kCTForegroundColorAttributeName as String): CGColor(red:0.91,green:0.94,blue:1,alpha:alpha), NSAttributedString.Key(kCTKernAttributeName as String): 2.0])
 let line = CTLineCreateWithAttributedString(str)
 let width = CTLineGetTypographicBounds(line,nil,nil,nil)
 ctx.textPosition = CGPoint(x:(Double(W)-width)/2,y:y)
 CTLineDraw(line,ctx)
}
for n in 0..<(fps*8) {
 while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval:0.002) }
 var b: CVPixelBuffer?
 CVPixelBufferPoolCreatePixelBuffer(nil, adapter.pixelBufferPool!, &b)
 let buffer=b!; CVPixelBufferLockBaseAddress(buffer, [])
 let ctx=CGContext(data: CVPixelBufferGetBaseAddress(buffer), width:W,height:H,bitsPerComponent:8,bytesPerRow:CVPixelBufferGetBytesPerRow(buffer),space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.noneSkipFirst.rawValue)!
 let t=Double(n)/Double(fps)
 let gradient=CGGradient(colorsSpace:CGColorSpaceCreateDeviceRGB(),colors:[CGColor(red:0.025,green:0.04,blue:0.105,alpha:1),CGColor(red:0.10,green:0.08,blue:0.21,alpha:1)] as CFArray,locations:[0,1])!
 ctx.drawLinearGradient(gradient,start:CGPoint(x:0,y:0),end:CGPoint(x:600,y:800),options:[])
 let glow=CGGradient(colorsSpace:CGColorSpaceCreateDeviceRGB(),colors:[CGColor(red:0.25,green:0.25,blue:0.8,alpha:0.30),CGColor(red:0.1,green:0.2,blue:0.6,alpha:0)] as CFArray,locations:[0,1])!
 ctx.drawRadialGradient(glow,startCenter:CGPoint(x:300,y:470),startRadius:0,endCenter:CGPoint(x:300,y:470),endRadius:360,options:[])
 let arrival=ease(t/2.6)
 let turn=(-0.12)*(1-arrival) + 0.018*sin(max(0,t-2.6)*0.9)
 let scale=0.76+0.24*arrival
 ctx.saveGState()
 ctx.setAlpha(ease(t/1.4))
 ctx.translateBy(x:300,y:470-45*(1-arrival)+4*sin(t*0.8))
 ctx.rotate(by:turn)
 ctx.scaleBy(x:scale*(0.7+0.3*arrival),y:scale)
 ctx.interpolationQuality = .high
 ctx.draw(image,in:CGRect(x:-258,y:-258,width:516,height:516))
 ctx.restoreGState()
 let title=ease((t-2.1)/1.5)
 text("Cereva",52,145-18*(1-title),title,ctx)
 text("INTRODUCING",12,730,title*0.7,ctx)
 // A quiet underline resolves with the title.
 ctx.setFillColor(CGColor(red:0.50,green:0.65,blue:1,alpha:title*0.7))
 ctx.fill(CGRect(x:300-24*title,y:81,width:48*title,height:1.5))
 if n == 390, let still=ctx.makeImage() {
   let dest=CGImageDestinationCreateWithURL(URL(fileURLWithPath:out+"/cereva-3d-thumbnail-600x800.jpg") as CFURL,UTType.jpeg.identifier as CFString,1,nil)!
   CGImageDestinationAddImage(dest,still,[kCGImageDestinationLossyCompressionQuality:0.93] as CFDictionary); CGImageDestinationFinalize(dest)
 }
 CVPixelBufferUnlockBaseAddress(buffer,[])
 if !adapter.append(buffer,withPresentationTime:CMTime(value:Int64(n),timescale:Int32(fps))) { fatalError("Frame failed: \(String(describing:writer.error))") }
}
input.markAsFinished()
let done=DispatchSemaphore(value:0)
writer.finishWriting { done.signal() }; done.wait()
guard writer.status == .completed else { fatalError("\(String(describing:writer.error))") }
print("Created 8-second 600x800 60fps H.264 MP4 and JPEG thumbnail")
