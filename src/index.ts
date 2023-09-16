import "@logseq/libs";
import {
  BlockEntity,
  PageEntity,
  PageIdentity,
} from "@logseq/libs/dist/LSPlugin.user";

/**
 * app entry
 */
const SENSITIVE = "sensitive";
let sensitiveUuids: string[] = [];

function updateSensitiveIcon(isSensitive: boolean) {
  const label = (isSensitive ? "Sensitive" : "Unsensitive") + " page";
  const icon = "ti-lock" + (isSensitive ? "" : "-open");
  logseq.App.registerUIItem("pagebar", {
    key: "sensitive-page",
    template: `
      <a class="button" data-on-click="toggleSensitivity" title="${label}">
        <i class="ti ${icon}" style="font-size: 20px;"></i>
      </a>
    `,
  });
}

async function isPageSensitive(
  page: PageEntity | BlockEntity,
): Promise<boolean> {
  const isSensitive = await logseq.Editor.getBlockProperty(
    page.uuid,
    SENSITIVE,
  );
  return isSensitive;
}

async function isCurrentPageSensitive(
  callback?: (sensitive: boolean, page: PageEntity) => Promise<void>,
) {
  const page = await logseq.Editor.getCurrentPage();
  if (page == null) return false;
  const isSensitive = await isPageSensitive(page);
  if (callback != null) callback(isSensitive, page as PageEntity);
  return isSensitive;
}

async function updateCurrentPageSensitiveIcon() {
  if (await isCurrentPageSensitive()) {
    updateSensitiveIcon(true);
  } else {
    updateSensitiveIcon(false);
  }
}

function addChildrenToUuidList(block: BlockEntity) {
  if (!block) return;
  addToUuidList(block);
  let children = (block?.children as BlockEntity[]) || [];
  for (let child of children) {
    addChildrenToUuidList(child);
  }
}

function addToUuidList(block: BlockEntity | PageEntity) {
  sensitiveUuids.push(block.uuid);
}

async function getAllSensitiveUuids() {
  sensitiveUuids = [];
  const pages = await logseq.Editor.getAllPages();
  if (pages == null) return;

  for (let page of pages) {
    if (await isPageSensitive(page)) {
      const pageBlocks = await logseq.Editor.getPageBlocksTree(page.uuid);
      addToUuidList(page);
      console.log(page.name, "IS SENSITIVE");
      for (let block of pageBlocks) {
        addChildrenToUuidList(block);
      }
    }
  }
}

function obfuscateUuids(uuids: PageIdentity[]) {
  // .fade-enter div .initial:has([blockid="${uuid}"]),
  let cssSensitiveBlocksSelector = uuids
    .map(
      (uuid) =>
        `.initial:has([blockid="${uuid}"])>div>div.breadcrumb, .initial:has([blockid="${uuid}"])>div>div.blocks-container, .references-blocks div[blockid="${uuid}"], span[data-block-ref="${uuid}"] .font-medium, span[data-block-ref="${uuid}"] span.inline-wrap`,
    )
    .join(", ");

  let cssMarkerSelector = uuids
    .map((uuid) => `span[data-block-ref="${uuid}"] mark`)
    .join(", ");

  logseq.provideStyle({
    key: "css-privacy",
    style: `
    ${cssSensitiveBlocksSelector} {
      filter: blur(3px) !important;
    }
    ${cssMarkerSelector} {
      background: transparent;
      color: inherit;
    }`,
  });
  logseq.provideStyle({
    key: "css-privacy-init",
    style: `
    .initial {
      filter: blur(0px);
    }`,
  });
}

async function main() {
  console.log("LOAD PLUGIN sensitivity");
  logseq.provideStyle({
    key: "css-privacy-init",
    style: `
    .initial {
      filter: blur(3px);
    }`,
  });

  // Handle page sensitivity button
  logseq.provideModel({
    async toggleSensitivity() {
      await isCurrentPageSensitive(
        async (isSensitive: boolean, page: PageEntity) => {
          const pageBlocks = await logseq.Editor.getPageBlocksTree(page.uuid);
          if (isSensitive) {
            await logseq.Editor.removeBlockProperty(page.uuid, SENSITIVE);
            await logseq.Editor.removeBlockProperty(
              pageBlocks[0].uuid,
              SENSITIVE,
            );
            updateSensitiveIcon(false);
          } else {
            await logseq.Editor.upsertBlockProperty(
              page.uuid,
              SENSITIVE,
              "true",
            );
            await logseq.Editor.updateBlock(
              pageBlocks[0].uuid,
              `${SENSITIVE}:: true\n${pageBlocks[0].content}`,
              { properties: { [SENSITIVE]: true } },
            );
            updateSensitiveIcon(true);
          }
        },
      );
    },
  });

  // Update page sensitivity button
  updateCurrentPageSensitiveIcon();
  logseq.App.onRouteChanged(async ({ path, template }) => {
    updateCurrentPageSensitiveIcon();
    await getAllSensitiveUuids();
    obfuscateUuids(sensitiveUuids);
  });

  // TODO: Check sensitive prop when block is manually edited
  // TODO: Add setting to display on hover, hide titles
  // TODO: Track uuids and necessary changes
  setTimeout(async () => {
    await getAllSensitiveUuids();
    obfuscateUuids(sensitiveUuids);
  }, 1000);
}

// bootstrap
logseq.ready(main).catch(console.error);
