const axios = require('axios');

class CopyleaksService {
    constructor() {
        this.email = process.env.COPYLEAKS_EMAIL;
        this.apiKey = process.env.COPYLEAKS_API_KEY;
        this.isSandbox = process.env.COPYLEAKS_SANDBOX === 'true';
        this.token = null;

        this.downloader = axios.create({
            timeout: 60000, 
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
    }

    async login() {
        try {
            const res = await axios.post('https://id.copyleaks.com/v3/account/login/api', {
                email: this.email,
                key: this.apiKey
            });
            this.token = res.data.access_token;
            return this.token;
        } catch (error) {
            console.error("Copyleaks Auth Error:", error.response?.data || error.message);
            throw new Error("Failed to authenticate with Copyleaks.");
        }
    }

    async getScanResults(scanId) {
        try {
            const token = await this.login();
            const res = await axios.get(`https://api.copyleaks.com/v3/scans/${scanId}/result`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return res.data;
        } catch (error) {
            if (error.response?.status === 404) {
                console.warn(`[Copyleaks] Scan ${scanId} results not found yet.`);
            }
            throw error;
        }
    }

    async submitScan(submission) {
        try {
            const token = await this.login();
            const scanId = submission._id.toString();
            
            let endpoint = '';
            let payload = {
                properties: {
                    sandbox: this.isSandbox,
                    action: 0,
                    aiDetection: { enabled: true },
                    webhooks: {
                        status: `${process.env.BACKEND_URL}/api/submissions/webhook/${scanId}/{STATUS}`,
                        headers: {
                            "x-copyleaks-signature": process.env.COPYLEAKS_WEBHOOK_SECRET || "sandbox-test-secret"
                        }
                    }
                }
            };

            if (['CODE_REPO', 'AI_NOTEBOOK'].includes(submission.submissionType)) {
                const repoUrl = submission.links?.repo || submission.links?.notebook;
                if (!repoUrl) throw new Error("No URL found for code scan");

                endpoint = `url/${scanId}`;
                payload.url = repoUrl;
            } else {
                if (!submission.attachments || submission.attachments.length === 0) {
                    throw new Error("No files attached.");
                }

                const fileUrl = submission.attachments[0].url;
                console.log(`[Copyleaks] Attempting stable download: ${fileUrl}`);

                const fileResponse = await this.downloader.get(fileUrl, { responseType: 'arraybuffer' });
                const base64Content = Buffer.from(fileResponse.data, 'binary').toString('base64');

                endpoint = `file/${scanId}`; 
                payload.base64 = base64Content;
                payload.filename = submission.attachments[0].name || "submission.docx";
            }

            const submitUrl = `https://api.copyleaks.com/v3/scans/submit/${endpoint}`;
            console.log(`[Copyleaks] Sending PUT to: ${submitUrl}`);

            await axios.put(submitUrl, payload, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                timeout: 45000
            });

            console.log(`✅ [Copyleaks] Scan ${scanId} successfully uploaded.`);
            return scanId;
        } catch (error) {
            const errorData = error.response?.data;
            console.error("❌ [Copyleaks Submission Error]:", error.message);
            if (errorData) console.error("Details:", JSON.stringify(errorData, null, 2));
            throw error;
        }
    }
}

module.exports = new CopyleaksService();