import type { Product } from '../types/product';

const complementaryCategories: Record<string, readonly string[]> = {
  vestidos: ['acessorios'],
  tops: ['leggings', 'acessorios', 'conjuntos'],
  leggings: ['tops', 'acessorios', 'conjuntos'],
  conjuntos: ['acessorios', 'tops', 'leggings'],
  acessorios: ['conjuntos', 'vestidos', 'tops', 'leggings'],
};

// These badges and promotions describe merchandising, not styling.
const merchandisingTags = new Set([
  'novidade', 'bestseller', 'quase-esgotado', 'em-destaque', 'black-friday',
]);

export function completeTheLook(product: Product, catalog: readonly Product[]): Product[] {
  const categories = complementaryCategories[product.cat] ?? [];
  const styleTags = new Set(product.tags.map(({ slug }) => slug).filter((slug) => !merchandisingTags.has(slug)));

  return catalog
    .filter((candidate) => candidate.id !== product.id &&
      candidate.slug !== 't-shirt-de-teste' &&
      candidate.marketStatus !== 'hidden' && candidate.marketStock > 0)
    .map((candidate) => {
      const pairingRank = categories.indexOf(candidate.cat);
      return {
        candidate,
        pairingRank: pairingRank < 0 ? categories.length : pairingRank,
        sharedTags: candidate.tags.filter(({ slug }) => styleTags.has(slug)).length,
        sameCategory: product.cat !== '' && candidate.cat === product.cat,
      };
    })
    .sort((a, b) =>
      a.pairingRank - b.pairingRank ||
      b.sharedTags - a.sharedTags ||
      Number(b.sameCategory) - Number(a.sameCategory))
    .slice(0, 4)
    .map(({ candidate }) => candidate);
}
