<div align="left">
  <p>
    <a href="https://moebits.github.io/waifu2x/"><img src="https://raw.githubusercontent.com/Moebits/waifu2x/master/assets/waifu2xlogo.png" width="500" /></a>
  </p>
  <p>
    <a href="https://nodei.co/npm/waifu2x/"><img src="https://nodei.co/npm/waifu2x.png" /></a>
  </p>
</div>

### About
This package uses pre-built Waifu2x binaries in order to upscale anime-styled images with node.js. For upscaling videos, you will also need
to have [**ffmpeg**](https://ffmpeg.org/) installed. For a gui version, you can also see my [Waifu2x GUI app](https://github.com/Moebits/Waifu2x-GUI).

Real-ESRGAN - To use Real-ESRGAN instead, set the upscaler to "real-esrgan" in the options. When using Real-ESRGAN, you can only provide scale factors from 2-4 and all other waifu2x specific settings are ignored. At 4x upscale it uses the Anime4x model which is a bit slower, but provides better results, so it is recommended to upscale at 4x when using Real-ESRGAN.

Real-CUGAN - To use Real-CUGAN instead, set the upscaler to "real-cugan" in the options. You can only provide scale factors 1/2/4 and all other waifu2x specific settings are ignored.

Anime4k - To use Anime4k, set the upscaler to "anime4k" in the options. Only the scale option is used. This is a fast upscaler suited for 
videos/gifs.

PyTorch Models - To use a custom pytorch model, set the upscaler to an absolute path to the model. All other settings are ignored.

### Insall
```ts
npm install waifu2x
```

### Useful Links
- [**waifu2x**](https://github.com/nagadomi/waifu2x)

#### Upscaling and/or de-noising images
```ts
import waifu2x from "waifu2x"

/*Upscale an image. If you specify a directory for the destination, the default name will be originalName2x. 
You can optionally set the noise level (0/1/2/3), scale factor (default 2.0), mode (noise/scale/noise-scale), pngCompression (0-9), and jpgWebpQuality (0-101).*/
await waifu2x.upscaleImage("./images/laffey.png", "./images/upscaled/laffey2x.png", {noise: 2, scale: 2.0})

/*Upscales all images in a directory. Set recursive to true to also upscale all images in all sub directories, or to false to only scale images in that specific folder (this is the default). The rename will be appended to the
end of all the new filenames (default is 2x).*/
await waifu2x.upscaleImages("./images", "./upscaled", {recursive: true, rename: "2x"}, progress)

/*You can also use absolute paths, or set a custom path to waifu2x if you are bundling it yourself. It must be the path to the folder that waifu2x-ncnn-vulkan.exe is in.*/
await waifu2x.upscaleImage("F:/Documents/image.png", "F:/Documents/image2x.png", {waifu2xPath: "F:/Documents/waifu2x"})

/*This callback function can track progress. Return true in order to stop early.*/
let progress = (current: number, total: number) => {
  console.log(`Current Image: ${current} Total Images: ${total}`)
  if (current === 5) return true
}

/*Percentage progress is Real-ESRGAN only. Return true to stop early.*/
let progress = (percent: number) => {
  console.log(`Percent: ${percent}`)
  if (percent > 50) return true
}
await waifu2x.upscaleImage("./images/laffey.png", "./images/upscaled/laffey2x.png", {scale: 4, upscaler: "real-esrgan"}, progress)
```

#### Upscaling Gifs / Animated Webps
```ts
/*Grab some popcorn, because this is going to take centuries without a high-end gpu. The speed parameter
changes the speed of the gif by removing frames or increasing the delay between frames. The reverse parameter
reverses the frames if true. You can also set the quality (1-Infinity) where lower is better. Setting scale to 1 skips the upscaling entirely.*/
await waifu2x.upscaleGIF("./images/gifs/megumin.gif", "./images/gifs/megumin2x.gif", {quality: 10, speed: 1.5, reverse: true}, progress)

/*Extremely impractical... unless you are converting GIFs with like 3 frames. The speed parameter is
the same as the upscaleGif() function. The limit parameter is the amount of gifs to process.*/
await waifu2x.upscaleGIFs("./images/gifs", "./images/gifs/upscaled", {speed: 1.0, limit: 10}, totalProgress, progress)

/*By default, only one frame is upscaled at a time, but you can change this with the option parallelFrames. Note that setting this
number too high can freeze your computer if it runs out of CPU/memory.*/
await waifu2x.upscaleGIF("./images/gifs/parallel.gif", "./images/gifs/parallel.gif", {parallelFrames: 3}, progress)

/*New: Support for animated webps. It has the same parameters as the upscaleGIF function, pretty much. You can tell that a webp is
animated because it will reject from the regular upscaleImage() function.*/
await waifu2x.upscaleAnimatedWebp("./images/webps/mywebp.webp", "./images/webps/mywebp2x.webp", {scale: 2}, progress)

/*You can pass callback functions to both to track progress. You can also return true in order to stop early.*/
let progress = (current: number, total: number) => {
  console.log(`Current Frame: ${current} Total Frames: ${total}`)
  if (current === 5) return true
}

let totalProgress = (current: number, total: number) => {
  console.log(`Current GIF: ${current} Total GIFs: ${total}`)
}
```

#### Upscaling Videos
```ts
/*Now you are going to be waiting for all of eternity. The time this takes is heavily dependent on the framerate
(default is original). You can also set the quality (0-51), where lower is better, and speed (0.5-100) and reverse as with the GIF.
Setting scale to 1 will skip the upscaling entirely.*/
await waifu2x.upscaleVideo("./images/videos/gab.mp4", "./images/videos/gab2x.mp4", {framerate: 24, quality: 16, speed: 1.5}, progress)

/*Well, this is really not a good idea... The limit parameter is the amount of videos to process.*/
await waifu2x.upscaleVideos("./images/videos", "./images/videos/upscaled", {reverse: true, limit: 10}, totalProgress, progress)

/*Setting parallelFrames higher can improve performance at the cost of using more resources.*/
await waifu2x.upscaleVideo("./images/videos/parallel.mp4", "./images/videos/parallel.mp4", {parallelFrames: 3}, progress)

/*You can track progress the same as with GIFs. Returning true stops early.*/
let progress = (current: number, total: number) => {
  console.log(`Current Frame: ${current} Total Frames: ${total}`)
  if (current === 30) return true
}

let totalProgress = (current: number, total: number) => {
  console.log(`Current Video: ${current} Total Videos: ${total}`)
}
```

#### Upscaling PDFs
```ts
/*Upscaling PDFs works the same as it does for gifs/videos. You can downscale height prior to upscaling.*/
await waifu2x.upscalePDF("./images/pdfs/hello.pdf", "./images/pdfs/hello2x.pdf", {scale: 2, downscaleHeight: 1000}, progress)

/*You can track progress the same as with GIFs/videos.*/
let progress = (current: number, total: number) => {
  console.log(`Current Frame: ${current} Total Frames: ${total}`)
}
```

#### Resuming GIFs/Videos/PDFs

If the program is terminated in the middle of upscaling a GIF or video, assuming that you provide the same options and that you didn't delete the frames folder, it will resume where it left off. This is useful for upscaling large GIFs/videos in multiple sittings.

#### Waifu2xFormats
```ts
export type Waifu2xFormats = 
    | "bmp"
    | "dib"
    | "exr"
    | "hdr"
    | "jpe" 
    | "jpeg" 
    | "jpg" 
    | "pbm" 
    | "pgm" 
    | "pic" 
    | "png" 
    | "pnm" 
    | "ppm" 
    | "pxm" 
    | "ras" 
    | "sr" 
    | "tif" 
    | "tiff" 
    | "webp" 
```

#### Waifu2xOptions
```ts
export interface Waifu2xOptions {
    upscaler?: "waifu2x" | "real-esrgan" | "real-cugan" | string
    noise?: -1 | 0 | 1 | 2 | 3
    scale?: number
    mode?: "noise" | "scale" | "noise-scale"
    pngCompression?: number
    jpgWebpQuality?: number
    threads?: number
    recursive?: boolean
    rename?: string
    limit?: number
    parallelFrames?: number
    waifu2xPath?: string
    waifu2xModel?: "models-cunet" | "models-upconv_7_anime_style_art_rgb"
    webpPath?: string
    esrganPath?: string
    cuganPath?: string
    scriptsPath?: string
    rifePath?: string
    rifeModel?: string
}
```

#### Waifu2xGIFOptions
```ts
export interface Waifu2xGIFOptions extends Waifu2xOptions {
    quality?: number
    speed?: number
    reverse?: boolean
    transparentColor?: string
    noResume?: boolean
    pngFrames?: boolean
}
```

#### Waifu2xAnimatedWebpOptions
```ts
export interface Waifu2xAnimatedWebpOptions extends Waifu2xOptions {
    quality?: number
    speed?: number
    reverse?: boolean
    noResume?: boolean
}
```

#### Waifu2xVideoOptions
```ts
export interface Waifu2xVideoOptions extends Waifu2xOptions {
    framerate?: number
    quality?: number
    speed?: number
    reverse?: boolean
    pitch?: boolean
    sdColorSpace?: boolean
    noResume?: boolean
    pngFrames?: boolean
    fpsMultiplier?: number
    ffmpegPath?: string
}
```

#### Waifu2xPDFOptions
```ts
export interface Waifu2xPDFOptions extends Waifu2xOptions {
    quality?: number
    reverse?: boolean
    noResume?: boolean
    pngFrames?: boolean
}
```
<details>
<summary>
<a href="https://www.pixiv.net/en/artworks/73851578">Source</a>
</summary>

`laffey.jpg`

<img src="https://raw.githubusercontent.com/Moebits/waifu2x/master/assets/laffey.jpg" />

`laffey2x.png`

<img src="https://raw.githubusercontent.com/Moebits/waifu2x/master/assets/laffey2x.jpg" />

</details>
