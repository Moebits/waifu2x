import {EventEmitter} from "events"
import waifu2x from "./waifu2x"

(async () => {
    const progress = (current: number, total: number) => {
        console.log(`Current: ${current} Total: ${total}`)
        if (current > 2) {
            return true
        }
    }
    const result = await waifu2x.upscaleGIF("./images/gifs/unnamed.gif", "./images/gifs/unnamed2x.gif", {}, progress)
    console.log(result)
    // const output = await waifu2x.upscaleImage("./images/laffey2.jpg", "./images/upscale")
    // console.log(output)
})()
