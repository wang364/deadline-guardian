/**
 * 时间格式验证工具函数
 * 验证时间格式是否为有效的 HH:MM 格式
 * @param {string} time - 要验证的时间字符串
 * @returns {boolean} - 是否为有效的时间格式
 */
const isValidTimeFormat = (time) => {
  if (!time || typeof time !== 'string') return false;
  const timeRegex = /^(\d{1,2}):(\d{1,2})$/;
  const trimmedTime = time.trim();
  // 使用 RegExp.exec() 以便获得更一致的匹配行为
  const match = timeRegex.exec(trimmedTime);
  
  if (!match) return false;
  
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
};

/**
 * 时间转换工具函数
 * 将本地时间转换为GMT时间
 * @param {string} localTime - 本地时间字符串 (HH:MM)
 * @returns {string} - GMT时间字符串 (HH:MM)
 */
const convertLocalTimeToGMT = (localTime) => {
  if (!isValidTimeFormat(localTime)) return localTime;
  
  // Use explicit radix to avoid RangeError from map(Number.parseInt)
  const [hours, minutes] = localTime.split(':').map(part => Number.parseInt(part, 10));
  const now = new Date();
  now.setHours(hours, minutes, 0, 0);
  
  // 转换为GMT时间
  const gmtHours = now.getUTCHours().toString().padStart(2, '0');
  const gmtMinutes = now.getUTCMinutes().toString().padStart(2, '0');
  
  return `${gmtHours}:${gmtMinutes}`;
};

/**
 * 时间转换工具函数
 * 将GMT时间转换为本地时间
 * @param {string} gmtTime - GMT时间字符串 (HH:MM)
 * @returns {string} - 本地时间字符串 (HH:MM)
 */
const convertGMTToLocalTime = (gmtTime) => {
  if (!isValidTimeFormat(gmtTime)) return gmtTime;
  
  // Use explicit radix to avoid RangeError from map(Number.parseInt)
  const [hours, minutes] = gmtTime.split(':').map(part => Number.parseInt(part, 10));
  const now = new Date();
  now.setUTCHours(hours, minutes, 0, 0);
  
  // 转换为本地时间
  const localHours = now.getHours().toString().padStart(2, '0');
  const localMinutes = now.getMinutes().toString().padStart(2, '0');
  
  return `${localHours}:${localMinutes}`;
};

/**
 * 获取当前时区偏移量
 * @returns {number} - 时区偏移量（分钟）
 */
const getTimezoneOffset = () => {
  return new Date().getTimezoneOffset();
};

module.exports = {
  isValidTimeFormat,
  convertLocalTimeToGMT,
  convertGMTToLocalTime,
  getTimezoneOffset
};