<template>
  <Widget :config="{ ...config, anchor }" move-handles="none" :removable="false" :inline-edit="false">
    <div :class="$style.window" class="relative text-gray-200 shadow-lg flex flex-col"
      :style="mode === 'browse' ? 'width: 64rem; max-width: 96vw; height: 88vh;' : 'width: 36rem; max-width: 96vw; max-height: 92vh;'">
      <!-- header -->
      <div :class="$style.titlebar" class="px-3 py-2 flex items-baseline gap-2">
        <span v-if="mode === 'browse'" class="font-bold truncate">{{ t(':browse_title') }}</span>
        <template v-else>
          <img v-if="safeIcon(item?.info.icon)" :src="safeIcon(item?.info.icon)!" class="w-6 h-6 object-contain self-center">
          <span class="font-bold truncate font-poe" :title="fItem?.baseType">{{ item?.info.name ?? '…' }}</span>
        </template>
        <span class="flex-1"></span>
        <span v-if="info" class="text-xs text-gray-500 truncate" :title="info.path">
          <i class="fas fa-filter"></i> {{ info.source?.name ?? info.name }}
          <span v-if="isCopy" class="ml-1 px-1 rounded bg-purple-800 text-purple-100">+ APT</span>
          <span v-else-if="info.kind === 'online'" class="ml-1 px-1 rounded bg-blue-800 text-blue-100">online</span>
        </span>
      </div>

      <div class="p-3 flex flex-col gap-3 overflow-y-auto">
        <div v-if="loading" class="text-gray-400">{{ t(':loading') }}</div>
        <div v-if="error" class="bg-red-900 text-red-100 rounded px-2 py-1 whitespace-pre-wrap">{{ error }}</div>

        <template v-if="!loading && parsed && info">
          <!-- a tier editor was closed with changes not saved -->
          <div v-for="u of unsaved" :key="u.id" class="bg-orange-900 text-orange-100 rounded px-2 py-1 text-sm flex items-center gap-2">
            <i class="fas fa-exclamation-triangle"></i>
            <span class="flex-1 min-w-0 truncate" :title="u.label">{{ t(':unsaved_changes', [u.label]) }}</span>
            <button class="btn bg-green-800" :disabled="busy" @click="saveUnsaved(u.id)"><i class="fas fa-check"></i> {{ t(':save') }}</button>
            <button class="btn" :disabled="busy" @click="dropUnsaved(u.id)">{{ t(':dont_save') }}</button>
          </div>

          <!-- state banners -->
          <div v-if="!isCopy && editsTotal" class="bg-yellow-900 text-yellow-100 rounded px-2 py-1 text-sm">
            {{ t(':edits_inactive', [editsTotal]) }}
            <button class="btn mt-1 w-full" :disabled="busy" @click="rebuild(true)">{{ t(':enable_copy') }}</button>
          </div>
          <div v-else-if="!isCopy" class="bg-blue-900 text-blue-100 rounded px-2 py-1 text-xs">
            {{ t(':copy_notice', [info.source ? copyNameOf(info.source) : '']) }}
          </div>
          <div v-if="isCopy && !info.source" class="bg-red-900 text-red-100 rounded px-2 py-1 text-sm">{{ t(':source_missing') }}</div>
          <div v-if="isCopy && sourceUpdated" class="bg-yellow-900 text-yellow-100 rounded px-2 py-1 text-sm">
            {{ t(':source_updated') }}
            <button class="btn mt-1 w-full" :disabled="busy" @click="rebuild(false)">{{ t(':rebuild_copy') }}</button>
          </div>
          <!-- items dropped from their tiers by the × of the older versions -->
          <div v-if="removedByX.length" class="bg-yellow-900 text-yellow-100 rounded px-2 py-1 text-sm">
            {{ t(':removed_items', [removedByX.length]) }}
            <div class="text-xs truncate" :title="removedByX.map(x => x.baseType).join(', ')">{{ removedByX.map(x => x.baseType).join(', ') }}</div>
            <div class="flex gap-2 mt-1">
              <button class="btn flex-1" :disabled="busy || !info.source" @click="fixRemoved(true)"><i class="fas fa-eye-slash"></i> {{ t(':removed_hide') }}</button>
              <button class="btn flex-1" :disabled="busy || !info.source" @click="fixRemoved(false)"><i class="fas fa-undo"></i> {{ t(':removed_return') }}</button>
            </div>
          </div>
          <div v-if="orphans.length" class="bg-yellow-900 text-yellow-100 rounded px-2 py-1 text-xs">{{ t(':orphans', [orphans.length]) }}</div>

          <template v-if="mode === 'item' && fItem && match">
          <div class="flex flex-col gap-2">
            <div v-if="!finalBlock" class="text-gray-400">{{ t(':no_rule') }}</div>

            <!-- the rule that styles the item, like FilterBlade's Simulate -->
            <div v-if="finalBlock" :class="$style.rule">
              <div :class="$style.ruleHead">
                <img v-if="finalIcon" :src="finalIcon" class="w-9 h-9 object-contain">
                <div class="flex-1 min-w-0">
                  <div class="font-poe text-lg text-white truncate" :title="finalBlock.headerComment">
                    {{ matchedRule ? matchedRule.label : ruleTitle(finalBlock) }}
                    <span v-if="matchedRule" class="px-1 rounded text-xs bg-purple-800 align-middle">APT</span>
                    <i v-if="patchOf(finalBlock)" class="fas fa-pen text-blue-400 text-xs align-middle" :title="t(':tier_changed')"></i>
                  </div>
                  <div class="text-xs text-gray-400 truncate">{{ [...conditionHints(finalBlock, t), t(':line', [finalBlock.startLine + 1])].join(' · ') }}</div>
                </div>
                <button v-if="!matchedRule" :class="$style.fbBtn" @click="findInCustomizer(finalBlock)">{{ t(':fb_find') }} <i class="fas fa-arrow-right"></i></button>
              </div>
              <div v-if="match.final!.result === null" class="text-xs text-yellow-400 px-2">{{ t(':assumed') }}</div>
              <template v-if="matchedRule">
                <div class="flex items-center gap-2 p-2">
                  <span class="px-2 py-0.5 font-poe" :style="previewStyle">{{ item!.info.name }}</span>
                  <span class="flex-1"></span>
                  <button :class="$style.fbBtn" :disabled="busy" @click="removeRule(matchedRule.id)"><i class="fas fa-undo"></i> {{ t(':remove_override') }}</button>
                </div>
                <!-- an own rule of the item is edited like a tier -->
                <TierEditor v-if="matchedRule.visibility !== 'Hide'"
                  :key="`editor-rule-${finalBlock.index}-${info.mtime}`"
                  :parsed="parsed" :block="finalBlock" :block-text="blockText(parsed, finalBlock)"
                  :item-name="item!.info.name" :has-patch="false" :busy="busy" is-rule
                  :rule-title="ruleTitle" :highlight="fItem.baseType" :rules="edits.rules"
                  @unsaved="addUnsaved(finalBlock!, $event)"
                  @save="saveTier(finalBlock!, $event)" @disable="removeRule(matchedRule.id)" />
              </template>
              <TierEditor v-else-if="!finalClosed"
                :key="`editor-final-${finalBlock.index}-${info.mtime}`"
                :parsed="parsed" :block="finalBlock" :block-text="blockText(parsed, finalBlock)"
                :item-name="item!.info.name" :has-patch="Boolean(patchOf(finalBlock))" :busy="busy"
                :rule-title="ruleTitle" :highlight="fItem.baseType" :rules="edits.rules"
                @hide-item="hideBase($event, finalBlock!)" @unhide-item="unhideBase($event, finalBlock!)" @own-rule="ownRule($event, finalBlock!)"
                @unsaved="addUnsaved(finalBlock!, $event)"
                @move="(bt: string, to: FilterBlock) => moveBaseType(bt, finalBlock!, to)"
                @save="saveTier(finalBlock!, $event)" @reset="resetTier(finalBlock!)"
                @disable="disableTier(finalBlock!)" @close="finalClosed = true" />
              <div v-else class="flex items-center gap-2 p-2">
                <span class="px-2 py-0.5 font-poe" :style="previewStyle">{{ item!.info.name }}</span>
                <span class="flex-1"></span>
                <button :class="$style.fbBtn" @click="finalClosed = false"><i class="fas fa-sliders-h"></i> {{ t(':edit_tier') }}</button>
              </div>
            </div>

            <!-- Continue rules = FilterBlade's "Decorators" -->
            <div v-if="match.continued.length" class="flex flex-col gap-1">
              <div class="text-center font-poe text-base text-white">{{ t(':fb_decorators') }}</div>
              <template v-for="ev of match.continued" :key="ev.block.index">
                <div :class="$style.decorator">
                  <span class="px-1.5 font-poe text-xs whitespace-nowrap" :style="chipStyle(ev.block)">{{ item!.info.name }}</span>
                  <span class="flex-1 truncate text-sm" :title="ev.block.headerComment">{{ ruleTitle(ev.block) }}</span>
                  <i v-if="patchOf(ev.block)" class="fas fa-pen text-blue-400 text-xs"></i>
                  <button :class="$style.fbBtn" :title="t(':edit_tier')" @click="toggleEditor('d', ev.block)"><i class="fas fa-sliders-h"></i></button>
                </div>
                <TierEditor v-if="isEditing('d', ev.block)"
                  :key="`editor-d${ev.block.index}-${info.mtime}`"
                  :parsed="parsed" :block="ev.block" :block-text="blockText(parsed, ev.block)"
                  :item-name="item!.info.name" :has-patch="Boolean(patchOf(ev.block))" :busy="busy"
                  :rule-title="ruleTitle" :highlight="fItem.baseType" :rules="edits.rules"
                  @hide-item="hideBase($event, ev.block)" @unhide-item="unhideBase($event, ev.block)" @own-rule="ownRule($event, ev.block)"
                  @unsaved="addUnsaved(ev.block, $event)"
                  @move="(bt: string, to: FilterBlock) => moveBaseType(bt, ev.block, to)"
                  @save="saveTier(ev.block, $event)" @reset="resetTier(ev.block)"
                  @disable="disableTier(ev.block)" @close="editing = null" />
              </template>
            </div>

            <!-- other rules for this kind of item: other stack sizes, area levels -->
            <details v-if="related.length" class="flex flex-col gap-1 mt-1" :open="related.length <= 8">
              <summary class="flex items-center gap-2 cursor-pointer">
                <span class="text-xs uppercase text-gray-500 flex-1">{{ t(':related', [item!.info.name]) }} · {{ related.length }}</span>
                <input v-if="related.length > 12" v-model.trim="relatedSearch" :placeholder="t(':search')"
                  class="rounded bg-gray-900 px-1 w-32 text-xs" @click.stop>
              </summary>
              <div class="flex flex-col gap-1 mt-1">
              <template v-for="ev of relatedShown" :key="ev.block.index">
                <div class="rounded bg-gray-900 px-2 py-1 flex items-center gap-2">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1 min-w-0">
                      <span :class="visibilityClass(ev.block.visibility)" class="px-1 rounded text-xs">{{ ev.block.visibility }}</span>
                      <span v-if="patchOf(ev.block)" class="px-1 rounded text-xs bg-blue-800" :title="t(':tier_changed')"><i class="fas fa-pen"></i></span>
                      <span class="truncate text-sm" :title="ev.block.headerComment">{{ ruleOf(ev.block)?.label ?? ruleTitle(ev.block) }}</span>
                    </div>
                    <div class="text-xs text-yellow-500 truncate" :title="ev.unknown.map(c => c.raw.trim()).join(' · ')">
                      {{ ev.unknown.length ? (conditionHints({ ...ev.block, conditions: ev.unknown }, t).join(' · ') || ev.unknown.map(c => c.raw.trim()).join(' · ')) : t(':always') }}
                    </div>
                  </div>
                  <span class="px-1.5 font-poe text-xs whitespace-nowrap" :style="chipStyle(ev.block)">{{ item!.info.name }}</span>
                  <button v-if="!ruleOf(ev.block)" class="btn text-xs" :title="t(':edit_tier')" @click="toggleEditor('r', ev.block)"><i class="fas fa-sliders-h"></i></button>
                  <button class="btn text-xs" :title="t(':this_one_hint')" @click="assume(ev.block.index)"><i class="fas fa-check"></i></button>
                </div>
                <TierEditor v-if="isEditing('r', ev.block)"
                  :key="`editor-r${ev.block.index}-${info.mtime}`"
                  :parsed="parsed" :block="ev.block" :block-text="blockText(parsed, ev.block)"
                  :item-name="item!.info.name" :has-patch="Boolean(patchOf(ev.block))" :busy="busy"
                  :rule-title="ruleTitle" :highlight="fItem.baseType" :rules="edits.rules"
                  @hide-item="hideBase($event, ev.block)" @unhide-item="unhideBase($event, ev.block)" @own-rule="ownRule($event, ev.block)"
                  @unsaved="addUnsaved(ev.block, $event)"
                  @move="(bt: string, to: FilterBlock) => moveBaseType(bt, ev.block, to)"
                  @save="saveTier(ev.block, $event)" @reset="resetTier(ev.block)"
                  @disable="disableTier(ev.block)" @close="editing = null" />
              </template>
              <button v-if="relatedFiltered.length > relatedShown.length" class="btn text-xs"
                @click="relatedShowAll = true">{{ t(':show_all', [relatedFiltered.length]) }}</button>
              </div>
            </details>
            <button v-if="assumed.size" class="text-xs text-gray-400 underline self-start" @click="assumed = new Set()">{{ t(':reset_assumed') }}</button>
          </div>

          <!-- item actions -->
          <div class="flex flex-col gap-2 border-t border-gray-700 pt-3">
            <div class="text-xs uppercase text-gray-500">{{ t(':this_item') }}</div>
            <button v-if="matchedRule" class="btn" :disabled="busy" @click="removeRule(matchedRule.id)">
              <i class="fas fa-undo"></i> {{ t(':remove_override') }}
            </button>
            <template v-else>
              <button v-if="finalBlock?.visibility !== 'Hide'" class="btn bg-red-800" :disabled="busy || !info.source" @click="addItemRule('Hide')">
                <i class="fas fa-eye-slash"></i> {{ t(':hide_item') }}
              </button>
              <button v-else class="btn" :disabled="busy || !info.source" @click="addItemRule('Show')">
                <i class="fas fa-eye"></i> {{ t(':show_item') }}
              </button>
              <div class="text-xs text-gray-500 -mt-1">{{ t(':rule_hint', [itemCondText]) }}</div>
            </template>

            <!-- the tier editor has the same for the items of its list -->
            <MoveBar v-if="!matchedRule && finalBlock && (finalClosed || !listsBase(finalBlock, fItem.baseType))"
              :parsed="parsed" :block="finalBlock" :base-type="fItem.baseType" :has-own-rule="false"
              :busy="busy || !info.source" :rule-title="ruleTitle"
              @move="moveBaseType(fItem!.baseType, finalBlock!, $event)" @own-rule="ownItemRule" />
          </div>

          </template>

          <!-- the whole filter, like FilterBlade -->
          <FilterBrowser v-if="mode === 'browse'" style="height: 70vh;"
            :parsed="parsed" :mtime="info.mtime" :busy="busy" :focus="browseFocus"
            :patch-of="patchOf" :rule-title="ruleTitle" :rule-for="ruleOf"
            @save="saveTier" @reset="resetTier" @disable="disableTier" @move="moveBaseType"
            :rules="edits.rules" @hide-item="hideBase" @unhide-item="unhideBase" @own-rule="ownRule" @unsaved="addUnsaved"
            @reset-blocks="resetBlocks" />

          <!-- all my edits for this filter -->
          <details v-if="editsTotal" class="text-sm" @toggle="editsOpen = ($event.target as HTMLDetailsElement).open">
            <summary class="cursor-pointer text-gray-400">{{ t(':my_edits', [editsTotal]) }}</summary>
            <div v-if="editsOpen" class="flex flex-col gap-1 mt-1">
              <div class="flex gap-2 items-center">
                <div class="flex-1 min-w-0 flex items-center gap-1 rounded bg-gray-900 px-2 py-0.5">
                  <i class="fas fa-search text-xs text-gray-500"></i>
                  <input v-model.trim="changesSearch" :placeholder="t(':changes_search')"
                    class="bg-transparent flex-1 min-w-0 text-xs outline-none">
                  <button v-if="changesSearch" class="text-xs text-gray-500 hover:text-gray-300" @click="changesSearch = ''"><i class="fas fa-times"></i></button>
                </div>
                <button class="btn text-xs" :disabled="busy || !info.source" :title="t(':export_changes_hint')" @click="exportChanges">
                  <i class="fas fa-download"></i> {{ t(':export_changes') }}
                </button>
              </div>
              <div class="text-xs text-gray-500">
                {{ changesSearch ? t(':changes_found', [changesShown.length, changes.length]) : t(':changes_hint') }}
              </div>
              <div v-for="{ entry: e, inTier } of changesShown" :key="e.id" class="bg-gray-900 rounded px-2 py-1">
                <div class="flex items-center gap-2 cursor-pointer" @click="toggleChange(e.id)">
                  <i class="fas text-xs text-gray-500 w-2" :class="openChanges.has(e.id) ? 'fa-caret-down' : 'fa-caret-right'"></i>
                  <span class="px-1 rounded text-xs" :class="badgeClass(e)">{{ badgeOf(e.kind) }}</span>
                  <span class="flex-1 truncate" :title="e.where ?? e.label">{{ e.label }}</span>
                  <span class="text-xs text-gray-500 whitespace-nowrap">{{ formatTime(e.time) }}</span>
                  <i v-if="e.orphan" class="fas fa-exclamation-triangle text-yellow-400" :title="t(':orphan')"></i>
                  <button class="text-xs text-gray-400 hover:text-red-400" :disabled="busy" :title="t(':remove_change')" @click.stop="removeEdit(e.id)"><i class="fas fa-times"></i></button>
                </div>
                <div v-if="inTier.length" class="pl-4 text-xs text-yellow-500 truncate" :title="inTier.join('\n')">
                  <i class="fas fa-search"></i> {{ inTierHint(inTier) }}
                </div>
                <div v-if="openChanges.has(e.id)" class="pl-4 pt-1 text-xs flex flex-col gap-0.5">
                  <div v-if="e.where" class="text-gray-500">{{ t(':rep_where', [e.where]) }}</div>
                  <div v-if="e.orphan" class="text-yellow-400">{{ t(':rep_orphan') }}</div>
                  <div v-for="(d, idx) of e.details" :key="idx" class="whitespace-pre-wrap" :class="detailClass(d)">{{ d }}</div>
                </div>
              </div>
            </div>
          </details>

          <!-- status / undo / update -->
          <div v-if="status" class="text-sm text-green-400">{{ status }}</div>
          <div class="flex gap-2 text-sm flex-wrap">
            <button v-if="history.length" class="btn" :disabled="busy" @click="undo"><i class="fas fa-undo"></i> {{ t(':undo') }}</button>
            <button v-if="pendingCommand" class="btn" @click="runPendingCommand"><i class="fas fa-play"></i> {{ t(':reload') }}</button>
            <button v-if="info.source" class="btn flex-1" :disabled="busy" @click="updateFilter" :title="t(':update_hint')">
              <i class="fas fa-sync" :class="{ 'fa-spin': updating }"></i> {{ t(':update') }}
            </button>
            <button v-if="info.source && editsTotal" class="btn" :class="$style.danger" :disabled="busy" @click="confirmClear = true">
              <i class="fas fa-trash-alt"></i> {{ t(':clear_all') }}
            </button>
          </div>
          <div class="flex gap-3 text-xs text-gray-500">
            <span v-if="fItem && mode === 'item'">{{ t(':area_level') }}: {{ fItem.areaLevel ?? '?' }}<template v-if="fItem.itemLevel != null"> · iLvl {{ fItem.itemLevel }}</template><template v-if="fItem.class"> · {{ fItem.class }}<template v-if="fItem.classIsGuess">?</template></template></span>
            <span class="flex-1"></span>
            <button v-if="mode === 'item'" class="underline" @click="mode = 'browse'">{{ t(':browse_open') }}</button>
            <button v-if="isCopy && info.source?.kind === 'online'" class="underline" @click="switchToSource">{{ t(':switch_online') }}</button>
            <button class="underline" @click="openBackupsFolder">{{ t(':backups') }}</button>
            <button class="underline" @click="openFilterBlade">FilterBlade</button>
          </div>
        </template>
      </div>

      <!-- confirmation: remove all my edits of this filter -->
      <div v-if="confirmClear && info?.source && editsTotal" :class="$style.confirmOverlay" @click.self="confirmClear = false">
        <div :class="$style.confirm" class="p-3 flex flex-col gap-2 rounded">
          <div class="font-bold text-red-200">
            <i class="fas fa-exclamation-triangle"></i> {{ t(':clear_title', [info.source.name]) }}
          </div>
          <div class="text-lg text-white">{{ t(':clear_count', [editsTotal]) }}</div>
          <div class="text-sm text-gray-400">{{ t(':clear_details', [edits.rules.length, edits.patches.length, edits.moves.length]) }}</div>
          <div class="text-xs text-gray-400">{{ t(':clear_hint') }}</div>
          <div class="flex gap-2 mt-1">
            <button class="btn flex-1" @click="confirmClear = false">{{ t(':clear_cancel') }}</button>
            <button class="btn flex-1" :class="$style.danger" :disabled="busy" @click="clearAll">
              <i class="fas fa-trash-alt"></i> {{ t(':clear_confirm', [editsTotal]) }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Widget>
</template>

<script lang="ts">
import type { WidgetSpec } from '../overlay/interfaces'
import type { LootFilterWidget } from './api'

export default {
  widget: {
    type: 'loot-filter',
    instances: 'single',
    initInstance: (): LootFilterWidget => {
      return {
        wmId: 0,
        wmType: 'loot-filter',
        wmTitle: '',
        wmWants: 'hide',
        wmZorder: 'exclusive',
        wmFlags: ['hide-on-blur', 'menu::skip'],
        hotkey: 'Ctrl + Shift + F',
        browseHotkey: 'Ctrl + Shift + L',
        filterPath: null,
        reloadAfterHide: true
      }
    }
  } satisfies WidgetSpec
}
</script>

<script setup lang="ts">
import { computed, inject, ref, shallowRef } from 'vue'
import { useI18nNs } from '@/web/i18n'
import { MainProcess } from '@/web/background/IPC'
import { AppConfig } from '@/web/Config'
import { parseClipboard, type ParsedItem } from '@/parser'
import type { WidgetManager } from '../overlay/interfaces'
import Widget from '../overlay/Widget.vue'
import TierEditor, { type TierChange } from './TierEditor.vue'
import MoveBar from './MoveBar.vue'
import FilterBrowser from './FilterBrowser.vue'
import { parseFilter, blockText, type FilterBlock, type ParsedFilter, type Visibility } from './filter-parser'
import { toFilterItem, type FilterItem } from './item-props'
import { matchItem, relatedBlocks } from './matcher'
import { listsBase } from './filter-edit'
import {
  ruleForItem, ruleForBase, ruleLines, ruleFromLines, ownRuleOf, withoutHiding,
  itemConditions, ruleIdOfBlock, onlineVersion, type AptRule
} from './apt-rules'
import {
  emptyEdits, editsCount, normalizeStore, storeKey as storeKeyOf, newId, selectorOf, patchForBlock, findBlock,
  buildCopy, copyName, copySourceVersion, applyPatch, withMove, splitAdded, isEmptyPatch, removedItems, withoutRemoved,
  type EditsStore, type FilterEdits, type FilterSource, type TierPatch, type BlockSelector
} from './edits'
import { describeChanges, searchChanges, renderReport, reportFileName, formatTime, badge, type ChangeEntry } from './changes-report'
import { canBeUnique } from './base-search'
import { iconForBlock, safeIcon } from './fb'
import { blockTitle, blockTierName, conditionHints } from './names'
import { styleFromActions, styleCss } from './style'
import * as api from './api'

const props = defineProps<{
  config: LootFilterWidget
}>()

const wm = inject<WidgetManager>('wm')!
const { t } = useI18nNs('loot_filter')

api.trackAreaLevel()

const checkPosition = ref({ x: 1, y: 1 })
const item = shallowRef<ParsedItem | null>(null)
const info = shallowRef<api.LootFilterInfo | null>(null)
const store = shallowRef<EditsStore>({})
const parsed = shallowRef<ParsedFilter | null>(null)
const loading = ref(false)
const busy = ref(false)
const updating = ref(false)
const error = ref<string | null>(null)
const status = ref<string | null>(null)
const assumed = ref(new Set<number>())
const history = shallowRef<FilterEdits[]>([])
// open editor of a decorator ('d') or related ('r') tier; found by selector,
// so it stays open after the filter is rewritten
const editing = shallowRef<{ kind: 'd' | 'r', selector: BlockSelector } | null>(null)
const pendingCommand = ref<string | null>(null)
// the "remove all my changes" question is shown
const confirmClear = ref(false)
// 'item': rules of the item under cursor; 'browse': the whole filter
const mode = ref<'item' | 'browse'>('item')
// the editor of the rule that styles the item is open unless closed
const finalClosed = ref(false)
const browseFocus = shallowRef<{ selector: BlockSelector, item?: string } | null>(null)

MainProcess.onEvent('MAIN->CLIENT::item-text', (e) => {
  if (e.target !== 'loot-filter') return

  const res = parseClipboard(e.clipboard)
  if (!res.isOk()) return
  checkPosition.value = e.position
  mode.value = 'item'
  finalClosed.value = false
  browseFocus.value = null
  relatedSearch.value = ''
  relatedShowAll.value = false
  item.value = res.value
  assumed.value = new Set()
  history.value = []
  editing.value = null
  status.value = null
  pendingCommand.value = null
  wm.show(props.config.wmId)
  load().catch(() => {})
})

MainProcess.onEvent('MAIN->CLIENT::widget-action', (e) => {
  if (e.target !== 'loot-filter-browse') return
  mode.value = 'browse'
  browseFocus.value = null
  item.value = null
  assumed.value = new Set()
  history.value = []
  editing.value = null
  status.value = null
  pendingCommand.value = null
  wm.show(props.config.wmId)
  load().catch(() => {})
})

props.config.wmWants = 'hide'
// restore the flag in case the app was closed while a chat command kept the window open
props.config.wmFlags = ['hide-on-blur', 'menu::skip']

async function load () {
  confirmClear.value = false
  loading.value = true
  error.value = null
  try {
    const [data, rules] = await Promise.all([
      api.loadActiveFilter(props.config.filterPath),
      api.loadRules()
    ])
    info.value = data
    store.value = normalizeStore(rules)
    parsed.value = parseFilter(data.contents)
  } catch (e) {
    info.value = null
    parsed.value = null
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

// ---- filter state ----

const isCopy = computed(() => info.value?.kind === 'managed')
const source = computed<FilterSource | null>(() => {
  const s = info.value?.source
  return s ? { kind: s.kind, id: s.id, name: s.name } : null
})
const key = computed(() => source.value ? storeKeyOf(source.value) : null)
const edits = computed<FilterEdits>(() => (key.value && store.value[key.value]) || emptyEdits())
const editsTotal = computed(() => editsCount(edits.value))
const sourceUpdated = computed(() => {
  const i = info.value
  if (!i?.source || i.kind !== 'managed') return false
  return copySourceVersion(i.contents) !== onlineVersion(i.source.contents)
})
const orphans = computed(() => {
  const i = info.value
  if (!i?.source || !editsTotal.value) return []
  return buildCopy(source.value!, i.source.contents, edits.value).orphans
})

function copyNameOf (s: FilterSource) {
  return copyName(s)
}

// ---- matching ----

const fItem = computed<FilterItem | null>(() => {
  if (!item.value) return null
  return toFilterItem(item.value, AppConfig().language, info.value?.areaLevel ?? api.currentArea().level)
})

const match = computed(() => {
  if (!parsed.value || !fItem.value) return null
  return matchItem(parsed.value, fItem.value, { assumeMatch: assumed.value })
})

const finalBlock = computed(() => match.value?.final?.block ?? null)

function ruleOf (block: FilterBlock): AptRule | null {
  const id = ruleIdOfBlock(block)
  if (id == null) return null
  return edits.value.rules.find(r => r.id === id) ??
    { id, label: block.headerComment, visibility: block.visibility, conditions: [], actions: [], createdAt: 0 }
}
function patchOf (block: FilterBlock): TierPatch | undefined {
  return parsed.value ? patchForBlock(parsed.value, edits.value, block) : undefined
}

const affecting = computed(() => {
  const m = match.value
  if (!m?.final) return []
  return [
    ...[...m.continued].map(ev => ({ block: ev.block, role: 'continue' as const })),
    { block: m.final.block, role: 'final' as const }
  ].reverse().map(e => ({ ...e, rule: ruleOf(e.block), patch: patchOf(e.block) }))
})

// rules for the same item with another stack size / area level (not shown above)
const related = computed(() => {
  if (!parsed.value || !fItem.value || !match.value) return []
  const shown = new Set(affecting.value.map(e => e.block.index))
  return relatedBlocks(parsed.value, fItem.value).filter(ev => !shown.has(ev.block.index))
})

const relatedSearch = ref('')
const relatedShowAll = ref(false)
const relatedFiltered = computed(() => {
  const q = relatedSearch.value.toLowerCase()
  if (!q) return related.value
  return related.value.filter(ev =>
    `${ruleTitle(ev.block)} ${ev.block.headerComment} ${ev.unknown.map(c => c.raw).join(' ')}`.toLowerCase().includes(q))
})
const relatedShown = computed(() => relatedShowAll.value ? relatedFiltered.value : relatedFiltered.value.slice(0, 30))

function chipStyle (block: FilterBlock) {
  return { ...styleCss(styleFromActions(block.actions), block.visibility === 'Hide'), fontSize: '0.75rem', borderWidth: '1px' }
}

const finalIcon = computed(() => finalBlock.value ? (iconForBlock(finalBlock.value) ?? safeIcon(item.value?.info.icon)) : null)

function findInCustomizer (block: FilterBlock) {
  browseFocus.value = { selector: selectorOf(block), item: fItem.value?.baseType }
  mode.value = 'browse'
}

const matchedRule = computed(() => finalBlock.value ? ruleOf(finalBlock.value) : null)
const itemCondText = computed(() => fItem.value ? itemConditions(fItem.value).join(', ') : '')

function assume (index: number) {
  assumed.value = new Set([...assumed.value, index])
}

const editingIndex = computed(() => (editing.value && parsed.value)
  ? findBlock(parsed.value, editing.value.selector)?.index ?? null
  : null)

function isEditing (kind: 'd' | 'r', block: FilterBlock) {
  return editing.value?.kind === kind && editingIndex.value === block.index
}

function toggleEditor (kind: 'd' | 'r', block: FilterBlock) {
  editing.value = isEditing(kind, block) ? null : { kind, selector: selectorOf(block) }
}

// ---- styling ----

function visibilityClass (v: Visibility) {
  return v === 'Hide' ? 'bg-gray-700 text-gray-300' : v === 'Minimal' ? 'bg-yellow-900 text-yellow-100' : 'bg-green-800 text-green-100'
}

// readable name: "Supplies: Wisdom Stacking — Tier 1"
function ruleTitle (block: FilterBlock) {
  return blockTitle(block, t)
}

const previewStyle = computed(() => {
  const m = match.value
  if (!m?.final) return styleCss(styleFromActions([]), false)
  const actions = [...m.continued.flatMap(e => e.block.actions), ...m.final.block.actions]
  return styleCss(styleFromActions(actions), m.final.block.visibility === 'Hide')
})

// ---- list of changes: what differs from the source filter ----

const editsOpen = ref(false)
const changesSearch = ref('')
const openChanges = ref(new Set<string>())

// the source filter is parsed only when the list is open
const sourceParsed = computed(() => {
  const text = info.value?.source?.contents
  return (editsOpen.value && text != null) ? parseFilter(text) : null
})

const changes = computed<ChangeEntry[]>(() => {
  if (!sourceParsed.value || !editsTotal.value) return []
  return describeChanges(sourceParsed.value, edits.value, t)
})

const changesShown = computed(() => searchChanges(changes.value, changesSearch.value, t))

// "в тире есть: The Doctor, House of Mirrors +3"
function inTierHint (items: string[]) {
  const list = items.slice(0, 3).join(', ') + (items.length > 3 ? ` +${items.length - 3}` : '')
  return t(':changes_in_tier', [list])
}

function toggleChange (id: string) {
  const set = new Set(openChanges.value)
  if (set.has(id)) set.delete(id)
  else set.add(id)
  openChanges.value = set
}

function badgeOf (kind: ChangeEntry['kind']) {
  return badge(kind, t)
}

function badgeClass (e: ChangeEntry) {
  if (e.kind === 'tier') return 'bg-blue-800'
  if (e.kind === 'move') return 'bg-teal-800'
  const rule = edits.value.rules.find(r => r.id === e.id)
  return visibilityClass(rule?.visibility ?? 'Show')
}

function detailClass (line: string) {
  if (line.startsWith('+')) return 'text-green-400'
  if (line.startsWith('-')) return 'text-red-400'
  return 'text-gray-300'
}

async function exportChanges () {
  const i = info.value
  if (!i?.source) return
  error.value = null
  try {
    const src = source.value!
    const entries = describeChanges(parseFilter(i.source.contents), edits.value, t)
    const text = renderReport({ source: src, sourceText: i.source.contents, entries, t })
    const res = await api.exportChanges(reportFileName(src), text)
    status.value = t(':export_done', [res.path])
  } catch (e) {
    error.value = (e as Error).message
  }
}

// ---- writing ----

// A chat command needs the game focused, and this window hides when the overlay
// loses focus: keep it open and take the focus back once the command is sent
let keepOpenTimer: ReturnType<typeof setTimeout> | undefined
function chat (command: string) {
  const id = props.config.wmId
  wm.setFlag(id, 'hide-on-blur', false)
  api.sendChatCommand(command, true)
  clearTimeout(keepOpenTimer)
  keepOpenTimer = setTimeout(() => {
    wm.setFlag(id, 'hide-on-blur', true)
    // the overlay didn't get the focus back: behave as before
    if (!wm.active.value) wm.hide(id)
  }, 1500)
}

function afterWrite (message: string, command: string) {
  assumed.value = new Set()
  status.value = message
  if (!props.config.reloadAfterHide) {
    pendingCommand.value = command
    return
  }
  if (command.startsWith('/itemfilter ')) {
    // the game may not see a just created filter file yet: wait a bit,
    // and keep the button to switch again if it failed
    pendingCommand.value = command
    setTimeout(() => chat(command), 1500)
  } else {
    pendingCommand.value = null
    chat(command)
  }
}

async function fileExists (path: string) {
  try {
    await api.statFile(path)
    return true
  } catch {
    return false
  }
}

// Save edits and write the copy "<filter>_APT.filter" that the game uses
// `keepFilter`: if the game uses the original filter, don't switch it to the copy
async function commit (newEdits: FilterEdits, message: string, opts?: { noHistory?: boolean, forceSwitch?: boolean, keepFilter?: boolean }) {
  const i = info.value
  if (!i?.source || !key.value) {
    error.value = t(':source_missing')
    return
  }
  busy.value = true
  error.value = null
  try {
    const oldEdits = edits.value
    const newStore = Object.fromEntries([
      ...Object.entries(store.value).filter(([k]) => k !== key.value),
      ...(editsCount(newEdits) ? [[key.value, newEdits] as const] : [])
    ])
    await api.saveRules(newStore)
    store.value = newStore

    const src = source.value!
    const { text } = buildCopy(src, i.source.contents, newEdits)
    const sep = i.filterDir.includes('\\') ? '\\' : '/'
    const name = isCopy.value ? i.name : copyName(src)
    const path = isCopy.value ? i.path : `${i.filterDir}${sep}${name}.filter`

    if (opts?.keepFilter && !isCopy.value) {
      // the copy isn't used now, but it must not keep the old edits
      if (await fileExists(path)) await api.saveFilter(path, text)
      if (!opts.noHistory) history.value = [...history.value, oldEdits]
      status.value = message
      return
    }

    const res = await api.saveFilter(path, text, isCopy.value ? i.mtime : undefined)
    const command = (isCopy.value && !opts?.forceSwitch) ? '/reloaditemfilter' : `/itemfilter ${name}`

    info.value = { ...i, kind: 'managed', name, path: res.path, contents: text, mtime: res.mtime }
    parsed.value = parseFilter(text)
    if (!opts?.noHistory) history.value = [...history.value, oldEdits]
    afterWrite(message, command)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}

function withEdits (fn: (e: FilterEdits) => FilterEdits, message: string) {
  return commit(fn(structuredClone({ ...edits.value })), message)
}

function addItemRule (visibility: Visibility) {
  const rule = ruleForItem(fItem.value!, visibility)
  return withEdits(e => ({ ...e, rules: [...e.rules, rule] }),
    visibility === 'Hide' ? t(':done_hidden') : t(':done_shown'))
}

function tierItemRule (baseType: string, block: FilterBlock, visibility: Visibility) {
  return ruleForBase(baseType, block, { visibility, isGear: canBeUnique(baseType, block) })
}

// the × on an item of a tier: hides the items that this tier shows, saved at once
function hideBase (baseType: string, block: FilterBlock) {
  if (busy.value) return
  const rule = tierItemRule(baseType, block, 'Hide')
  return withEdits(e => ({ ...e, rules: [...e.rules, rule] }), t(':done_hidden'))
}

function unhideBase (baseType: string, block: FilterBlock) {
  if (busy.value) return
  return withEdits(e => ({ ...e, rules: withoutHiding(parsed.value!, e.rules, baseType, block) }), t(':done_shown'))
}

// ---- own rule of one base type: starts as a copy of its tier's rule ----

async function ownRule (baseType: string, block: FilterBlock) {
  if (busy.value) return
  const existing = ownRuleOf(parsed.value!, edits.value.rules, baseType, block)
  const rule = existing ?? tierItemRule(baseType, block, 'Show')
  if (!existing) {
    await withEdits(e => ({ ...e, rules: [...withoutHiding(parsed.value!, e.rules, baseType, block), rule] }), t(':done_own_rule', [baseType]))
  }
  openRule(rule.id, baseType)
}

async function ownItemRule () {
  if (busy.value) return
  const rule = tierItemRule(fItem.value!.baseType, finalBlock.value!, 'Show')
  await withEdits(e => ({ ...e, rules: [...e.rules, rule] }), t(':done_own_rule', [rule.label]))
}

// open the editor of my rule (the rule of the item under cursor is already open)
function openRule (id: string, baseType: string) {
  if (!parsed.value || matchedRule.value?.id === id) return
  const block = parsed.value.blocks.find(b => ruleOf(b)?.id === id)
  if (!block) return
  browseFocus.value = { selector: selectorOf(block), item: baseType }
  mode.value = 'browse'
}

function saveRule (rule: AptRule, change: TierChange) {
  const patch: TierPatch = { id: rule.id, selector: { header: '', fingerprint: '' }, label: rule.label, updatedAt: 0, ...change }
  const changed = ruleFromLines(rule, applyPatch(ruleLines(rule), patch))
  if (!changed) return removeRule(rule.id)
  return withEdits(e => ({ ...e, rules: e.rules.map(r => r.id === rule.id ? changed : r) }), t(':done_rule'))
}

// ---- items dropped from their tiers by the × of the older versions ----

const removedByX = computed(() => parsed.value ? removedItems(parsed.value, edits.value) : [])

function fixRemoved (hide: boolean) {
  const items = removedByX.value
  return withEdits(e => {
    const out = withoutRemoved(e, items)
    return hide ? { ...out, rules: [...out.rules, ...items.map(x => tierItemRule(x.baseType, x.block, 'Hide'))] } : out
  }, hide ? t(':done_hidden') : t(':done_returned'))
}

// ---- edits of a tier left without Save: ask what to do with them ----

interface UnsavedTier { id: string, selector: BlockSelector, label: string, change: TierChange }
const unsaved = shallowRef<UnsavedTier[]>([])

function addUnsaved (block: FilterBlock, change: TierChange) {
  const selector = selectorOf(block)
  const same = (u: UnsavedTier) => JSON.stringify(u.selector) === JSON.stringify(selector)
  unsaved.value = [...unsaved.value.filter(u => !same(u)), { id: newId(), selector, label: ruleTitle(block), change }]
}

function dropUnsaved (id: string) {
  unsaved.value = unsaved.value.filter(u => u.id !== id)
}

async function saveUnsaved (id: string) {
  const u = unsaved.value.find(x => x.id === id)
  if (!u || !parsed.value) return
  const block = findBlock(parsed.value, u.selector)
  if (!block) {
    error.value = t(':unsaved_lost', [u.label])
    dropUnsaved(id)
    return
  }
  await saveTier(block, u.change)
  if (!error.value) dropUnsaved(id)
}

function removeRule (id: string) {
  return withEdits(e => ({ ...e, rules: e.rules.filter(r => r.id !== id) }), t(':done_override_removed'))
}

function movedIn (e: FilterEdits, baseType: string, from: FilterBlock, to: FilterBlock) {
  const src = parseFilter(info.value!.source!.contents)
  return withMove(e, parsed.value!, src, baseType, from, to, `${baseType} → ${ruleTitle(to)}`)
}

function moveBaseType (baseType: string, from: FilterBlock, to: FilterBlock) {
  if (busy.value || !info.value?.source) return
  return withEdits(e => movedIn(e, baseType, from, to), t(':done_moved_to', [baseType, blockTierName(to, t)]))
}

function saveTier (block: FilterBlock, change: TierChange) {
  const rule = ruleOf(block)
  if (rule) return saveRule(rule, change)
  // items of other tiers are moved, not copied: they would stay in both
  const { moved, added } = splitAdded(parsed.value!, block, change.addBaseTypes ?? [])
  if (moved.length && info.value?.source) {
    change = { ...change, addBaseTypes: added.length ? added : undefined }
  }
  const old = patchOf(block)
  let patch: TierPatch
  if (change.raw != null) {
    patch = { id: old?.id ?? newId(), selector: old?.selector ?? selectorOf(block), label: ruleTitle(block), raw: change.raw, updatedAt: Date.now() }
  } else {
    patch = {
      ...(old ?? { id: newId(), selector: selectorOf(block), label: ruleTitle(block) }),
      raw: undefined,
      disabled: undefined,
      visibility: change.visibility ?? old?.visibility,
      actions: { ...old?.actions, ...change.actions },
      conditions: { ...old?.conditions, ...change.conditions },
      ...mergeItemLists(old, change),
      updatedAt: Date.now()
    }
  }
  return withEdits(e => {
    const patches = e.patches.filter(p => p.id !== patch.id)
    const out = { ...e, patches: isEmptyPatch(patch) ? patches : [...patches, patch] }
    return info.value?.source ? moved.reduce((acc, m) => movedIn(acc, m.baseType, m.from, block), out) : out
  }, t(':done_tier'))
}

// adding an item that was removed earlier cancels the removal, and vice versa
function mergeItemLists (old: TierPatch | undefined, change: TierChange) {
  let add = [...(old?.addBaseTypes ?? [])]
  let remove = [...(old?.removeBaseTypes ?? [])]
  for (const bt of change.removeBaseTypes ?? []) {
    if (add.includes(bt)) add = add.filter(x => x !== bt)
    else if (!remove.includes(bt)) remove.push(bt)
  }
  for (const bt of change.addBaseTypes ?? []) {
    if (remove.includes(bt)) remove = remove.filter(x => x !== bt)
    else if (!add.includes(bt)) add.push(bt)
  }
  return { addBaseTypes: add.length ? add : undefined, removeBaseTypes: remove.length ? remove : undefined }
}

// FilterBlade's RESET of a category: drop my changes of these tiers
function resetBlocks (blocks: FilterBlock[]) {
  const indexes = new Set(blocks.map(b => b.index))
  const inSet = (sel: BlockSelector) => {
    const b = findBlock(parsed.value!, sel)
    return b != null && indexes.has(b.index)
  }
  return withEdits(e => ({
    ...e,
    patches: e.patches.filter(p => !inSet(p.selector)),
    moves: e.moves.filter(m => !inSet(m.to))
  }), t(':done_tier_reset'))
}

function resetTier (block: FilterBlock) {
  const old = patchOf(block)
  if (!old) return
  return withEdits(e => ({ ...e, patches: e.patches.filter(p => p.id !== old.id) }), t(':done_tier_reset'))
}

function disableTier (block: FilterBlock) {
  const rule = ruleOf(block)
  if (rule) return removeRule(rule.id)
  const old = patchOf(block)
  const patch: TierPatch = {
    id: old?.id ?? newId(),
    selector: old?.selector ?? selectorOf(block),
    label: ruleTitle(block),
    disabled: true,
    updatedAt: Date.now()
  }
  return withEdits(e => ({ ...e, patches: [...e.patches.filter(p => p.id !== patch.id), patch] }), t(':done_tier_disabled'))
}

function removeEdit (id: string) {
  return withEdits(e => ({
    rules: e.rules.filter(r => r.id !== id),
    patches: e.patches.filter(p => p.id !== id),
    moves: e.moves.filter(m => m.id !== id)
  }), t(':done_override_removed'))
}

async function clearAll () {
  if (busy.value) return
  confirmClear.value = false
  await commit(emptyEdits(), t(':done_cleared', [editsTotal.value]), { keepFilter: true })
  changesSearch.value = ''
  openChanges.value = new Set()
}

function rebuild (switchToCopy: boolean) {
  return commit(edits.value, t(':done_rebuilt'), { noHistory: true, forceSwitch: switchToCopy })
}

async function undo () {
  const prev = history.value[history.value.length - 1]
  if (!prev) return
  history.value = history.value.slice(0, -1)
  // on the original filter there is only "remove all" to undo
  await commit(prev, t(':done_undo'), { noHistory: true, keepFilter: true })
}

// ---- update: download the latest online filter and re-apply edits ----

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function waitForChange (path: string, before: number, timeout: number) {
  const until = Date.now() + timeout
  while (Date.now() < until) {
    await sleep(500)
    try {
      if ((await api.statFile(path)).mtime !== before) return true
    } catch {}
  }
  return false
}

async function updateFilter () {
  const i = info.value
  if (!i?.source) return
  updating.value = true
  busy.value = true
  error.value = null
  status.value = t(':updating')
  try {
    if (i.source.kind === 'online') {
      const cachePath = i.source.path
      const before = (await api.statFile(cachePath)).mtime
      let changed = false
      if (isCopy.value) {
        // the game downloads an online filter when it is selected
        chat(`/itemfilter ${i.source.name}`)
        changed = await waitForChange(cachePath, before, 6000)
      }
      if (!changed) {
        // on the online filter `/reloaditemfilter` downloads it again
        await sleep(400)
        chat('/reloaditemfilter')
        changed = await waitForChange(cachePath, before, 10000)
      }
      if (!changed) {
        throw new Error(t(':update_failed', [i.source.name]))
      }
      await sleep(300)
      const fresh = await api.loadActiveFilter(cachePath)
      info.value = { ...i, source: fresh.source }
    } else {
      const fresh = await api.loadActiveFilter(i.source.path)
      info.value = { ...i, source: fresh.source }
    }
    busy.value = false
    await sleep(400)
    await commit(edits.value, t(':done_updated'), { noHistory: true, forceSwitch: true })
  } catch (e) {
    error.value = (e as Error).message
    status.value = null
  } finally {
    updating.value = false
    busy.value = false
  }
}

function runPendingCommand () {
  if (pendingCommand.value) chat(pendingCommand.value)
  pendingCommand.value = null
}

function switchToSource () {
  if (info.value?.source) chat(`/itemfilter ${info.value.source.name}`)
}

function openBackupsFolder () {
  api.openBackupsFolder().catch(() => {})
}

function openFilterBlade () {
  window.open('https://www.filterblade.xyz/?game=Poe1')
}

// ---- position (same as item info widget) ----

const anchor = computed(() => {
  if (mode.value === 'browse') return { pos: 'cc', x: 50, y: 50 }
  const width = wm.size.value.width
  const poePanelWidth = wm.poePanelWidth.value
  const side = checkPosition.value.x > (window.screenX + width / 2) ? 'inventory' : 'stash'
  return {
    pos: side === 'stash' ? 'cl' : 'cr',
    y: 50,
    x: side === 'stash'
      ? (poePanelWidth / width) * 100
      : ((width - poePanelWidth) / width) * 100
  }
})
</script>

<style lang="postcss" module>
.window {
  background: #05081a;
  border: 1px solid #2a3470;
}
.titlebar {
  background: #0a0f3a;
  border-bottom: 1px solid #2a3470;
}
.confirmOverlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  padding: 1rem;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.7);
}
.confirm {
  margin: auto;
  width: 26rem;
  max-width: 100%;
  background: #05081a;
  border: 1px solid #991b1b;
}
/* `.btn` sets its own background after the utilities */
.window .danger {
  background: #742a2a;
  color: #fed7d7;
}
.window .danger:hover:not(:disabled) {
  background: #9b2c2c;
}
.rule {
  background: #000;
  border: 1px solid #2a4fa8;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding-bottom: 0.4rem;
}
.ruleHead {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.4rem 0.6rem;
  background: #0d1a5a;
  border-left: 3px solid #1b8fc1;
}
.fbBtn {
  background: #0b2a6e;
  border: 1px solid #2a4fa8;
  color: #fff;
  font-size: 0.8rem;
  padding: 0.2rem 0.6rem;
  white-space: nowrap;
}
.fbBtn:hover:not(:disabled) {
  background: #1d3787;
}
.fbBtn:disabled {
  opacity: 0.5;
}
.decorator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  background: #0d1a5a;
}
</style>
