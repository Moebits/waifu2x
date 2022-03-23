import waifu2x from "./waifu2x"

(async () => {
    const progress = (current: number, total: number) => {
        console.log(`Current: ${current} Total: ${total}`)
    }
    const options = {
        noise: 2,
        scale: 2,
        mode: 'noise-scale',
        quality: 16,
        speed: 1,
        reverse: false,
        cumulative: true,
        framerate: 30,
        jpgWebpQuality: 100,
        pngCompression: 3,
        threads: 4,
        disableGPU: false,
        forceOpenCL: false,
        rename: '2x',
        blockSize: 1024,
        parallelFrames: 2,
        transparency: true,
        pitch: true,
        ffmpegPath: undefined,
        waifu2xPath: '/Users/chris/Documents/Tenpi/Programming/Applications/waifu2x-gui/waifu2x'
      } as any
    const result = await waifu2x.upscaleVideo("/Users/chris/Downloads/159669460-64a7bfa5-0616-4ede-8124-0df239260ca2.mp4", "/Users/chris/Downloads/test/159669460-64a7bfa5-0616-4ede-8124-0df239260ca22x.mp4", options, progress)
    // const result = await waifu2x.upscaleGIF("./images/gifs/fbi.gif", "./images/gifs/fbi2x.gif", {scale: 1.1, parallelFrames: 2}, progress)
    // const result = await waifu2x.upscaleImage("./images/laffey2.jpg", "./images/upscale/laffey22x.jpg").catch((e) => console.log(e))
    console.log(result)
})()
