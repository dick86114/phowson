-- 启用 pgvector 扩展（需要提前安装 pgvector）
-- 安装命令：sudo apt-get install postgresql-15-pgvector
-- 或者使用 Docker: docker run -e POSTGRES_PASSWORD=pass -p 5432:5432 pgvector/pgvector:pg15

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
    CREATE EXTENSION IF NOT EXISTS vector;

    -- 为 photos 表添加 embedding 字段
    -- 使用 Gemini text-embedding-004 模型（768 维）
    ALTER TABLE photos ADD COLUMN IF NOT EXISTS embedding vector(768);

    -- 创建向量索引以加速相似度搜索（使用 HNSW 算法）
    -- 注意：索引创建可能较慢，如果数据量大可以后续创建
    CREATE INDEX IF NOT EXISTS photos_embedding_idx
    ON photos
    USING hnsw (embedding vector_cosine_ops);

    -- 添加注释
    COMMENT ON COLUMN photos.embedding IS '照片内容的向量表示，用于语义搜索（768维）';
  ELSE
    RAISE NOTICE 'pgvector 未安装，跳过 embedding 字段与向量索引迁移';
  END IF;
END $$;
