/**
 * AI Embedding Service
 * 使用 Gemini Embedding API 生成文本向量表示
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * 生成文本的向量表示
 * @param {string} text - 需要编码的文本内容
 * @returns {Promise<number[]>} 768 维向量数组
 */
export async function generateEmbedding(text) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY 未配置');
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    
    const result = await model.embedContent(text);
    const embedding = result.embedding;
    
    // 返回向量值数组
    return embedding.values;
  } catch (error) {
    console.error('[Embedding] 生成失败:', error.message);
    throw new Error(`Embedding 生成失败: ${error.message}`);
  }
}

/**
 * 为照片生成语义文本描述
 * 组合标题、描述、标签、AI 点评、EXIF 信息等
 * @param {object} photo - 照片对象
 * @returns {string} 组合后的语义文本
 */
export function buildSemanticText(photo) {
  const parts = [];
  
  if (photo.title) parts.push(`标题: ${photo.title}`);
  if (photo.description) parts.push(`描述: ${photo.description}`);
  if (photo.tags) parts.push(`标签: ${photo.tags}`);
  if (photo.category) parts.push(`分类: ${photo.category}`);
  if (photo.aiCritique) parts.push(`AI 点评: ${photo.aiCritique}`);
  
  // EXIF 信息
  if (photo.exif) {
    try {
      const exif = typeof photo.exif === 'string' ? JSON.parse(photo.exif) : photo.exif;
      
      if (exif.Model) parts.push(`相机: ${exif.Model}`);
      if (exif.LensModel) parts.push(`镜头: ${exif.LensModel}`);
      if (exif.FNumber) parts.push(`光圈: F${exif.FNumber}`);
      if (exif.ExposureTime) parts.push(`快门: ${exif.ExposureTime}秒`);
      if (exif.ISO) parts.push(`ISO: ${exif.ISO}`);
      if (exif.FocalLength) parts.push(`焦距: ${exif.FocalLength}mm`);
    } catch (e) {
      // 解析失败时忽略
    }
  }
  
  return parts.join(' | ');
}

/**
 * 批量生成多个照片的 embedding
 * @param {array} photos - 照片对象数组
 * @returns {Promise<Map<string, number[]>>} photoId -> embedding 的映射
 */
export async function batchGenerateEmbeddings(photos) {
  const results = new Map();
  
  // 串行处理以避免 API 速率限制
  for (const photo of photos) {
    try {
      const text = buildSemanticText(photo);
      const embedding = await generateEmbedding(text);
      results.set(photo.id, embedding);
      
      console.log(`[Embedding] 已生成 ${photo.id} - ${photo.title}`);
    } catch (error) {
      console.error(`[Embedding] 失败 ${photo.id}:`, error.message);
      // 继续处理其他照片
    }
    
    // 添加延迟以避免速率限制（Gemini API 有 QPM 限制）
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return results;
}
