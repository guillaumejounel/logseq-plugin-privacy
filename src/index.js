import '@logseq/libs'

/**
 * app entry
 */
const SENSITIVE = "sensitive";
let sensitiveUuids = []

function updateSensitiveIcon(isSensitive) {
  const label = (isSensitive ? "Sensitive" : "Unsensitive") + " page"
  const icon = "ti-lock" + (isSensitive ? '' : '-open')
  logseq.App.registerUIItem('pagebar', {
    key: 'sensitive-page',
    template: `
      <a class="button" data-on-click="toggleSensitivity" title="${label}">
        <i class="ti ${icon}" style="font-size: 20px;"></i>
      </a>
    `,
  })
}

async function isCurrentPageSensitive(callback) {
  const page = await logseq.Editor.getCurrentPage()
  const isSensitive = page && page.properties?.[SENSITIVE]
  if (callback != null) callback(isSensitive, page.uuid)
  return isSensitive
}

async function updateCurrentPageSensitiveIcon() {
  if (await isCurrentPageSensitive()) {
    updateSensitiveIcon(true)
  } else {
    updateSensitiveIcon(false)
  }
}


function recurseChildren(block, func) {
  if (!block) return
  func(block)
  let children = block?.children || []
  for (let child of children) {
    recurseChildren(child, func)
  }
}

function addToUuidList(block) {
  sensitiveUuids.push(block.uuid)
}

async function getAllSensitiveUuids() {
  const pages = await logseq.Editor.getAllPages()
  for (let page of pages) {
    if (!page.uuid) continue
    const isSensitive = await logseq.Editor.getBlockProperty(page.uuid, SENSITIVE)
    if (isSensitive) {
      const pageBlocks = await logseq.Editor.getPageBlocksTree(page.uuid)
      addToUuidList(page)
      for (let block of pageBlocks) {
        recurseChildren(block, addToUuidList)
      }
    }
  }
}

function obfuscateUuids(uuids) {
  let cssSensitiveBlocksSelector = uuids.map(
    uuid => `div.initial:has(.animate-pulse) .initial, .initial:has([blockid="${uuid}"])>div>div.breadcrumb, .initial:has([blockid="${uuid}"])>div>div.blocks-container, .references-blocks div[blockid="${uuid}"], span[data-block-ref="${uuid}"] .font-medium, span[data-block-ref="${uuid}"] span.inline-wrap`
  ).join(", ")

  let cssMarkerSelector = uuids.map(
    uuid => `span[data-block-ref="${uuid}"] mark`
  ).join(", ")

  logseq.provideStyle({
    key: "css-privacy",
    style: `
    ${cssSensitiveBlocksSelector} {
      filter: blur(3px) !important;
    }
    ${cssMarkerSelector} {
      background: transparent;
      color: inherit;
    }`
  })

  
}

async function main() {
  // Handle page sensitivity button
  logseq.provideModel({
    async toggleSensitivity () {
      await isCurrentPageSensitive(async (isSensitive, pageUuid) => {
        const pageBlocks = await logseq.Editor.getPageBlocksTree(pageUuid)
        if (isSensitive) {
          await logseq.Editor.removeBlockProperty(pageUuid, SENSITIVE)
          await logseq.Editor.removeBlockProperty(pageBlocks[0].uuid, SENSITIVE)
          updateSensitiveIcon(false)
        } else {
          await logseq.Editor.upsertBlockProperty(pageUuid, SENSITIVE, "true")
          await logseq.Editor.updateBlock(pageBlocks[0].uuid, `${SENSITIVE}:: true\n${pageBlocks[0].content}`, { properties: {[SENSITIVE] : true }})
          updateSensitiveIcon(true)
        }
      })
    }
  })

  // Update page sensitivity button
  updateCurrentPageSensitiveIcon()
  logseq.App.onRouteChanged(async ({ path, template }) => {
    updateCurrentPageSensitiveIcon()
    await getAllSensitiveUuids()
  })

  // TODO: Use typescript
  // TODO: Check sensitive prop when block is manually edited
  // TODO: Add setting to display on hover
  // TODO: Add setting to hide titles

  // TODO: Track uuids and necessary changes
  setTimeout(async () => {
    await getAllSensitiveUuids()
    obfuscateUuids(sensitiveUuids)
  }, 1000)
  
}

// bootstrap
logseq.ready(main).catch(console.error)
