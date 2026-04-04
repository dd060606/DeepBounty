const currentDate = () => {
  const date = new Date();
  return (
    date.getFullYear() +
    "-" +
    ("0" + (date.getMonth() + 1)).slice(-2) +
    "-" +
    ("0" + date.getDate()).slice(-2) +
    " " +
    ("0" + date.getHours()).slice(-2) +
    ":" +
    ("0" + date.getMinutes()).slice(-2) +
    ":" +
    ("0" + date.getSeconds()).slice(-2)
  );
};

const formatMessage = (level: string, message: string) => {
  return `[${currentDate()}] [Worker] [${level}] ${message}`;
};

export const logger = {
  info: (message: string) => {
    console.log(formatMessage("INFO", message));
  },
  warn: (message: string) => {
    console.warn(formatMessage("WARN", message));
  },
  error: (message: string, error?: any) => {
    let output = message;
    if (error) {
      if (error.stack) {
        output += `\n${error.stack}`;
      } else if (error.message) {
        output += `: ${error.message}`;
      } else {
        output += `: ${JSON.stringify(error)}`;
      }
    }
    console.error(formatMessage("ERROR", output));
  },
};
