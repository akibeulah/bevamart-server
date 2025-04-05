const defaultResponse = (res, data) => {
    if (data.length < 3)
        throw new Error("Incomplete response data")
    return res.status(200).json({
        code: data[0],
        message: data[1],
        data: data[2]
    })
}

module.exports = { defaultResponse }