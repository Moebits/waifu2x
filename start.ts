import {EventEmitter} from "events"
import waifu2x from "./waifu2x"

(async () => {
    const progress = (current: number, total: number) => {
        console.log(`Current: ${current} Total: ${total}`)
        if (current > 2) {
            return true
        }
    }
    // const result = await waifu2x.upscaleGIF("./images/gifs/fbi.gif", "./images/gifs/fbi2x.gif")
    // console.log(result)
})()
