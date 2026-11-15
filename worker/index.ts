// Web (workers.dev) の入口。中身は gate.ts。
// このファイルはハンドラ以外を export しない (workerd が起動時に拒否する)。
import { handleRequest, type Env } from "./gate.ts";

export default {
  fetch: (request: Request, env: Env): Promise<Response> => handleRequest(request, env),
};
