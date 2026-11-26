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

const recommendationLimit = 4;
const initialCategoryLimit = 2;

function pairingTieBreak(productId: string, candidateId: string): number {
  // Keep equivalent suggestions stable across refreshes while varying them by product.
  let hash = 2166136261;
  for (const character of `${productId}:${candidateId}`) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  }
  return (hash ^ (hash >>> 16)) >>> 0;
}

export function completeTheLook(product: Product, catalog: readonly Product[]): Product[] {
  const categories = complementaryCategories[product.cat] ?? [];
  const styleTags = new Set(product.tags.map(({ slug }) => slug).filter((slug) => !merchandisingTags.has(slug)));

  const ranked = catalog
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
        tieBreak: pairingTieBreak(product.id, candidate.id),
      };
    })
    .sort((a, b) =>
      a.pairingRank - b.pairingRank ||
      b.sharedTags - a.sharedTags ||
      Number(b.sameCategory) - Number(a.sameCategory) ||
      a.tieBreak - b.tieBreak)
    .map(({ candidate }) => candidate);

  const selected: Product[] = [];
  const overflow: Product[] = [];
  const categoryCounts = new Map<string, number>();
  for (const candidate of ranked) {
    const count = categoryCounts.get(candidate.cat) ?? 0;
    if (count < initialCategoryLimit) {
      selected.push(candidate);
      categoryCounts.set(candidate.cat, count + 1);
      if (selected.length === recommendationLimit) return selected;
    } else {
      overflow.push(candidate);
    }
  }
  return [...selected, ...overflow.slice(0, recommendationLimit - selected.length)];
}
