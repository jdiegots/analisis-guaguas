// Parse HTML response from WMS GetFeatureInfo
function parseTourismHtml(html) {
  const features = [];

  // Split by feature blocks (each feature has "Establecimiento:" or similar)
  const blocks = html.split(/<table[^>]*>/i).slice(1); // Skip header

  for (const block of blocks) {
    if (!block.trim() || block.includes('IDECanarias') || block.includes('Grafcan')) {
      continue;
    }

    const feature = { properties: {} };

    // Extract all rows with epigrafe/valor pattern
    const rowPattern = /<td[^>]*class\s*=\s*["\']?epigrafe[^>]*>([^<]+)<\/td>\s*<td[^>]*class\s*=\s*["\']?valor[^>]*>([^<]+)<\/td>/gi;

    let match;
    while ((match = rowPattern.exec(block)) !== null) {
      const key = match[1].replace(/:/g, '').trim();
      const value = match[2].replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').trim();

      feature.properties[key] = value;
    }

    // Only add if we found at least establishment name
    if (feature.properties['Establecimiento']) {
      features.push(feature);
    }
  }

  return features;
}

// Test with sample HTML
const sampleHtml = `
<table width="100%" border="0" cellspacing="0" cellpadding="4">
	<tr>
		<td class=epigrafe width="25%" nowrap valign=top>Establecimiento: </td>
		<td class="valor align="left" valign=top>Ca&#39;Benitez (B-35-1-0006157)</td>
	</tr>
	<tr>
		<td class=epigrafe width="25%" nowrap valign=top>Dirección: </td>
		<td class="valor align="left" valign=top>CALLE MALTA, 4</td>
	</tr>
</table>
`;

const result = parseTourismHtml(sampleHtml);
console.log(JSON.stringify(result, null, 2));

module.exports = { parseTourismHtml };
