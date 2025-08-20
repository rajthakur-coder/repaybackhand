// Safe integer parsing
function safeParseInt(value, fallback = null) {
    const n = Number.parseInt(value, 10);
    return Number.isNaN(n) ? fallback : n;
}

// BigInt -> String conversion
function convertBigIntToString(obj) {
    return JSON.parse(JSON.stringify(obj, (_, value) =>
        typeof value === 'bigint' ? value.toString() : value
    ));
}

module.exports = {
    safeParseInt,
    convertBigIntToString
};
