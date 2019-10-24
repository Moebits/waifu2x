import waifu2x from "./Waifu2x"

const result = waifu2x.upScaleImages("./images", "./images/upscale", {recursion: 0})
console.log(result)