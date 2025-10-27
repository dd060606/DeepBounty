import axios from "axios";

export async function sendTestRequest() {
	return await axios.head("https://google.com");
}
