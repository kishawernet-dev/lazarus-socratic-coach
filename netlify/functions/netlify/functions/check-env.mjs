export const handler = async () => {
  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      hasOpenAI: Boolean(process.env.OPENAI_API_KEY),
      hasTeacherPassword: Boolean(process.env.TEACHER_PASSWORD),
      hasBlobSiteId: Boolean(process.env.NETLIFY_BLOBS_SITE_ID || process.env.SITE_ID),
      hasBlobToken: Boolean(process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN),
      blobSiteIdPreview: String(process.env.NETLIFY_BLOBS_SITE_ID || process.env.SITE_ID || "").slice(0, 8),
      runtimeSiteIdPreview: String(process.env.SITE_ID || "").slice(0, 8)
    })
  };
};
