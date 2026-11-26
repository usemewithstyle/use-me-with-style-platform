import { expect, test } from '@playwright/test';

const activeTag = { id: 1, slug: 'active-tennis', labelPT: 'Ténis', labelEN: 'Tennis' };
const featuredTag = { id: 2, slug: 'em-destaque', labelPT: 'Em destaque', labelEN: 'Featured' };

function product(id: number, slug: string, category: string, stockAO = 5, tag: (typeof activeTag)[] = []) {
  return {
    id, slug, name: slug, category: { id: category, slug: category, namePT: category },
    priceAOKz: 10000, pricePTEur: 100, active: true, availableAO: true, availablePT: true, tag,
    variants: [{ id: `variant-${id}`, size: 'M', stockAO, stockPT: 5 }],
  };
}

test('only products in stock for this market fill the look, ordered by pairing and shared style', async ({ page }) => {
  const products = [
    product(1, 'solo-dress', 'vestidos'),
    product(2, 'matching-set', 'conjuntos', 5, [activeTag]),
    product(3, 'featured-leggings', 'leggings', 5, [featuredTag]),
    product(4, 'tennis-leggings', 'leggings', 5, [activeTag]),
    product(5, 'solo-top', 'tops', 5, [activeTag, featuredTag]),
    product(6, 'court-socks', 'acessorios'),
    product(7, 'sold-out-cap', 'acessorios', 0),
    product(8, 't-shirt-de-teste', 'tops'),
    { ...product(9, 'portugal-bag', 'acessorios'), availableAO: false },
  ];
  await page.addInitScript(() => {
    localStorage.setItem('ump-market-pref', 'AO');
    localStorage.setItem('ump-lang-pref', 'en');
  });
  await page.route('**/api/**', route => route.fulfill({ json: { docs: [] } }));
  await page.route('**/api/products**', route => route.fulfill({ json: { docs: products } }));

  const look = page.getByRole('region', { name: 'Complete the look' });
  const recommendations = look.locator('a[href^="/produto/"]');
  await page.goto('/produto/solo-top');
  await expect(recommendations).toHaveCount(4);
  await expect(recommendations.nth(0)).toHaveAttribute('href', '/produto/tennis-leggings');
  await expect(recommendations.nth(1)).toHaveAttribute('href', '/produto/featured-leggings');
  await expect(recommendations.nth(2)).toHaveAttribute('href', '/produto/court-socks');
  await expect(recommendations.nth(3)).toHaveAttribute('href', '/produto/matching-set');

  await page.goto('/produto/solo-dress');
  await expect(recommendations).toHaveCount(4);
  await expect(recommendations.first()).toHaveAttribute('href', '/produto/court-socks');
  await expect(look.locator('a[href*="sold-out"], a[href*="portugal-bag"], a[href*="t-shirt-de-teste"]')).toHaveCount(0);

  await page.route('**/api/products**', route => route.fulfill({
    json: { docs: products.filter(({ category }) => category.slug !== 'leggings') },
  }));
  await page.goto('/produto/solo-top');
  await expect(recommendations).toHaveCount(3);
  await expect(recommendations.nth(0)).toHaveAttribute('href', '/produto/court-socks');
  await expect(recommendations.nth(1)).toHaveAttribute('href', '/produto/matching-set');
  await expect(recommendations.nth(2)).toHaveAttribute('href', '/produto/solo-dress');

});
