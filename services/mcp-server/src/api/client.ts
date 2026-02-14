import axios, { AxiosInstance } from "axios";

export class SEBNeXuSAPI {
  private client: AxiosInstance;

  constructor(baseURL: string, apiToken: string) {
    this.client = axios.create({
      baseURL,
      headers: { Authorization: `Bearer ${apiToken}` },
      timeout: 30000,
    });
  }

  async listServers(filters?: any) {
    return (await this.client.get("/servers", { params: filters })).data;
  }

  async createContent(data: any) {
    return (await this.client.post("/cms/content", data)).data;
  }

  async purgeCDNCache(data: any) {
    return (await this.client.post("/cdn/purge", data)).data;
  }

  async cacheGet(layer: string, key: string) {
    return (await this.client.get(`/cache/${layer}/${key}`)).data;
  }
}
