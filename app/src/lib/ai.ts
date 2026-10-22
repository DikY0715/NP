// AI 药品识别 —— 通过后端 /api/ai/recognize（API 密钥由服务端持有，前端不再直连）
import { api, type RecognizedMedicine } from '@/lib/api';

export type { RecognizedMedicine };

/** 调用后端识别药盒信息，失败时抛出带可读文案的 Error */
export async function recognizeMedicine(imageDataUrl: string): Promise<RecognizedMedicine> {
  const result = await api.recognize(imageDataUrl);
  if (!result.name) {
    throw new Error('未识别出药品名称，请将药盒正面放入取景框后重试');
  }
  return result;
}
