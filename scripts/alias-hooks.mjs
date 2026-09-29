export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const bare = specifier.slice(2)
    const file = bare.endsWith(".ts") ? bare : `${bare}.ts`
    return nextResolve(new URL(`../${file}`, import.meta.url).href, context)
  }
  return nextResolve(specifier, context)
}
