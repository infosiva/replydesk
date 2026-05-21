import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://zerostaff.app', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://zerostaff.app/login', lastModified: new Date(), changeFrequency: 'yearly', priority: 0.5 },
    { url: 'https://zerostaff.app/signup', lastModified: new Date(), changeFrequency: 'yearly', priority: 0.8 },
  ]
}
