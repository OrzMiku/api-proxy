// server/routes/[...].ts

import { proxyTargets } from "~/utils/proxy";

export default defineEventHandler(async (event) => {
  const path = event.path;

  // 寻找匹配的代理目标
  const targetConfig = proxyTargets.find((item) => path.startsWith(item.path));

  if (targetConfig) {
    // 构造目标 URL，并正确处理路径和查询参数
    const requestUrl = getRequestURL(event);
    const remainingPath = requestUrl.pathname.replace(targetConfig.path, "");
    const targetUrl = new URL(remainingPath, targetConfig.target);
    targetUrl.search = requestUrl.search;

    // 移除客户端 IP 相关 headers，保护隐私
    const headers = getRequestHeaders(event);
    delete headers["x-forwarded-for"];
    delete headers["x-real-ip"];

    try {
      // 转发请求到目标 API
      return await proxyRequest(event, targetUrl.toString(), {
        headers,
      });
    }
    catch (error) {
      // 如果上游服务出错，将错误信息和状态码返回给客户端
      console.error(`[Proxy Error] Failed to proxy to ${targetUrl.toString()}:`, error);
      setResponseStatus(event, error.statusCode || 500);
      return {
        error: "Proxy request failed",
        details: error.message,
      };
    }
  }

  // 如果没有找到匹配的路由，返回 404
  setResponseStatus(event, 404);
  return "404 Not Found";
});
