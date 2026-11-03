let cloudinaryInstance = null;

try {
  const cloudinaryPkg = await import("cloudinary");
  const cloudinary = cloudinaryPkg.v2 || cloudinaryPkg.default?.v2 || cloudinaryPkg.default;
  if (cloudinary?.config) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "",
      api_key: process.env.CLOUDINARY_API_KEY || "",
      api_secret: process.env.CLOUDINARY_API_SECRET || "",
      secure: true,
    });
    cloudinaryInstance = cloudinary;
  }
} catch (e) {
  console.warn("⚠️ Cloudinary initialization notice:", e.message);
}

export const isCloudinaryConfigured = () =>
  !!(
    cloudinaryInstance &&
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );

export default cloudinaryInstance;
