import axios from "axios";

export async function sendTestRequest() {
  return await axios.get("https://api.github.com");
}
