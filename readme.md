<div align="left">
  <p>
    <a href="https://tenpi.github.io/waifu2x/"><img src="https://raw.githubusercontent.com/Tenpi/waifu2x/master/assets/waifu2xlogo.png" width="500" /></a>
  </p>
  <p>
    <a href="https://nodei.co/npm/waifu2x/"><img src="https://nodei.co/npm/waifu2x.png" /></a>
  </p>
</div>

### About
This package uses the pre-built Windows x64 binaries from [**waifu2x-converter-cpp**](https://github.com/DeadSix27/waifu2x-converter-cpp) in order to upscale anime-styled images with node.js.

### Insall
```ts
npm install waifu2x
```

### Useful Links
- [**waifu2x**](https://github.com/nagadomi/waifu2x)
- [**waifu2x-converter-cpp**](https://github.com/DeadSix27/waifu2x-converter-cpp)

#### Upscaling and/or de-noising images
```ts
import waifu2x from "waifu2x"

/*Upscale an image. If you specify a directory for the destination, the default name will be originalName2x. 
You can optionally set the noise level (0/1/2/3), scale factor (default 2.0), pngCompression (0-9), and jpgWebpQuality (0-101).*/
await waifu2x.upscaleImage("./images/laffey.png", "./images/upscaled/laffey2x.png", {noise: 2, scale: 2.0})

/*Recursively upscales all images in a directory. Set recursion to 1 to also upscale all images in all sub directories
(this is the default), or to 0 to only scale images in that specific folder. You can also optionally specify the 
recursionFormat, which will be the format for all the converted images, and the rename, which will be appended to the
end of all the new filenames (default is 2x).*/
await waifu2x.upscaleImages("./images", "./upscaled", {recursion: 1, rename: "2x"})

/*There are some additional options, like using absolute paths or calling waifu2x-converter-cpp directly (to use your own installation)*/
await waifu2x.upscaleImage("F:/Documents/image.png", "F:/Documents/image2x.png", {absolutePath: true, callFromPath: true})
```

#### Upscaling Gifs
```ts
/*Grab some popcorn, because this is going to take centuries without a high-end gpu. The speed parameter
changes the speed of the gif by removing frames or increasing the delay between frames.*/
await waifu2x.upscaleGIF("./images/gifs/megumin.gif", "./images/gifs", {speed: 1.5})

/*Extremely impractical... unless you are converting GIFs with like 3 frames. The speed parameter is
the same as the upscaleGif() function. The limit parameter is the amount of gifs to process.*/
await waifu2x.upscaleGIFs("./images/gifs", "./images/gifs/upscaled", {speed: 1.0, limit: 10})
```

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
    noise?: 0 | 1 | 2 | 3
    scale?: number
    pngCompression?: number
    jpgWebpQuality?: number
    recursion?: 0 | 1
    recursionFormat?: Waifu2xFormats
    rename?: string
    callFromPath?: boolean
    absolutePath?: boolean
}
```

#### Waifu2xGIFOptions
```ts
export interface Waifu2xGIFOptions extends Waifu2xOptions {
    speed?: number
    limit?: number
}
```
<details>
<summary>
<a href="https://www.pixiv.net/en/artworks/73851578">Source</a>
</summary>

`laffey.jpg`

<img src="https://raw.githubusercontent.com/Tenpi/waifu2x/master/assets/laffey.jpg" />

`laffey2x.png`

<img src="https://raw.githubusercontent.com/Tenpi/waifu2x/master/assets/laffey2x.png" />

</details>