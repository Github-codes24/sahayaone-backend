import { Brand } from "../../models/brand.model.js";
import { Product } from "../../models/product.model.js";
import { Variant } from "../../models/variant.model.js";
import { logger } from "../../utils/logger.util.js";

export const seedCatalog = async () => {
  try {
    // 0. Clean slate for catalog to ensure static IDs and images are fresh
    await Variant.deleteMany({});
    await Product.deleteMany({});
    await Brand.deleteMany({});
    logger.info("SEEDER: Cleared catalog collections for static ID and image synchronization.");

    // 1. Seed Brands with static IDs and working public images
    const brandData = [
      { _id: "65a6c1e5f83cd8b5b82c1601", name: "Apple", logo: "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=200&h=200&fit=crop" },
      { name: "Samsung", logo: "https://images.unsplash.com/photo-1610792516307-ea5acd9c3b00?w=200&h=200&fit=crop" },
      { name: "Xiaomi", logo: "https://picsum.photos/id/20/200/200" },
      { name: "Sony", logo: "https://picsum.photos/id/30/200/200" },
      { name: "Oppo", logo: "https://picsum.photos/id/40/200/200" },
      { name: "Vivo", logo: "https://picsum.photos/id/50/200/200" },
      { name: "OnePlus", logo: "https://picsum.photos/id/60/200/200" },
      { name: "Huawei", logo: "https://picsum.photos/id/70/200/200" },
      { name: "Motorola", logo: "https://picsum.photos/id/80/200/200" },
      { name: "Realme", logo: "https://picsum.photos/id/90/200/200" },
      { name: "Nokia", logo: "https://picsum.photos/id/100/200/200" },
      { name: "Honor", logo: "https://picsum.photos/id/110/200/200" },
      { name: "Nothing", logo: "https://picsum.photos/id/120/200/200" },
      { name: "Google Pixel", logo: "https://picsum.photos/id/130/200/200" },
      { name: "Infinix", logo: "https://picsum.photos/id/140/200/200" },
    ];

    const seededBrands = [];
    for (const b of brandData) {
      let brand = await Brand.findOne({ name: b.name });
      if (!brand) {
        brand = await Brand.create(b);
        logger.info(`SEEDER: Seeded Brand: ${b.name}`);
      }
      seededBrands.push(brand);
    }

    const appleBrand = seededBrands.find((b) => b.name === "Apple");
    if (!appleBrand) return;

    // 2. Seed Apple Products with static IDs and working public images
    const appleProducts = [
      {
        _id: "65a6c1e5f83cd8b5b82c1602",
        name: "iPhone 17",
        category: "Mobiles on EMI",
        image: "https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=300&h=400&fit=crop",
      },
      {
        name: "iPhone 17 Plus",
        category: "Mobiles on EMI",
        image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=300&h=400&fit=crop",
      },
      {
        name: "iPhone 17 Pro",
        category: "Mobiles on EMI",
        image: "https://images.unsplash.com/photo-1523206489230-c012c64b2b48?w=300&h=400&fit=crop",
      },
      {
        name: "iPhone 17 Pro Max",
        category: "Mobiles on EMI",
        image: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=300&h=400&fit=crop",
      },
      { name: "iPhone 12", category: "Mobiles on EMI", image: "https://images.unsplash.com/photo-1605787020600-b9ebd5df1d07?w=300&h=400&fit=crop" },
      { name: "iPhone 11", category: "Mobiles on EMI", image: "https://images.unsplash.com/photo-1573148195900-7845dcb9b127?w=300&h=400&fit=crop" },
    ];

    const seededProducts = [];
    for (const p of appleProducts) {
      let product = await Product.findOne({ brandId: appleBrand._id, name: p.name });
      if (!product) {
        product = await Product.create({ brandId: appleBrand._id, ...p });
        logger.info(`SEEDER: Seeded Product: Apple ${p.name}`);
      }
      seededProducts.push(product);
    }

    const iphone17 = seededProducts.find((p) => p.name === "iPhone 17");
    if (!iphone17) return;

    // 3. Seed iPhone 17 Variants with static IDs and working public images
    const iphone17Variants = [
      {
        _id: "65a6c1e5f83cd8b5b82c1603",
        color: "Teal",
        storage: "256 GB ROM",
        warranty: "1 year warranty",
        price: 79999,
        image: "https://images.unsplash.com/photo-1616348436168-de43ad0db179?w=300&h=400&fit=crop",
      },
      {
        _id: "65a6c1e5f83cd8b5b82c1604",
        color: "Black",
        storage: "256 GB ROM",
        warranty: "1 year warranty",
        price: 79999,
        image: "https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=300&h=400&fit=crop",
      },
      {
        _id: "65a6c1e5f83cd8b5b82c1605",
        color: "Mist Blue",
        storage: "256 GB ROM",
        warranty: "1 year warranty",
        price: 79999,
        image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=300&h=400&fit=crop",
      },
      {
        _id: "65a6c1e5f83cd8b5b82c1606",
        color: "Sage",
        storage: "512 GB ROM",
        warranty: "1 year warranty",
        price: 94999,
        image: "https://images.unsplash.com/photo-1523206489230-c012c64b2b48?w=300&h=400&fit=crop",
      },
      {
        _id: "65a6c1e5f83cd8b5b82c1607",
        color: "Black",
        storage: "512 GB ROM",
        warranty: "1 year warranty",
        price: 94999,
        image: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=300&h=400&fit=crop",
      },
      {
        _id: "65a6c1e5f83cd8b5b82c1608",
        color: "Mist Blue",
        storage: "512 GB ROM",
        warranty: "1 year warranty",
        price: 94999,
        image: "https://images.unsplash.com/photo-1605787020600-b9ebd5df1d07?w=300&h=400&fit=crop",
      },
      {
        _id: "65a6c1e5f83cd8b5b82c1609",
        color: "Lavender",
        storage: "512 GB ROM",
        warranty: "1 year warranty",
        price: 94999,
        image: "https://images.unsplash.com/photo-1573148195900-7845dcb9b127?w=300&h=400&fit=crop",
      },
    ];

    for (const v of iphone17Variants) {
      let variant = await Variant.findOne({ productId: iphone17._id, color: v.color, storage: v.storage });
      if (!variant) {
        await Variant.create({
          productId: iphone17._id,
          name: `Apple ${iphone17.name} ${v.color} (${v.storage})`,
          ...v
        });
        logger.info(`SEEDER: Seeded Variant: Apple iPhone 17 ${v.color} (${v.storage})`);
      }
    }

    logger.info("SEEDER: Product catalog seed operations completed successfully.");
  } catch (err) {
    logger.error(`SEEDER ERROR: Failed to seed product catalog: ${err.message}`);
    throw err;
  }
};
