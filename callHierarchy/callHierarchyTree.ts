/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAsyncDataSource, ITreeRenderer, ITreeNode, ITreeSorter } from './tree/tree'
import { CallHierarchyItem, CallHierarchyDirection, CallHierarchyModel } from './callHierarchy'
// import { CancellationToken } from '../../../../base/common/cancellation.js'
import { IIdentityProvider, IListVirtualDelegate } from './list/list.js'
// import { FuzzyScore, createMatches } from '../../../../base/common/filters.js'
// import { IconLabel } from '../../../../base/browser/ui/iconLabel/iconLabel.js'
import { Location } from './common/languages.js'
import { compare } from './common/strings.js'
import { Range } from './common/range.js'
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js'
// import { localize } from '../../../../nls.js'; // 번역
// import { ThemeIcon } from '../../../../base/common/themables.js'

/**
 * Represents a single call in the call hierarchy.
 */
export class Call {
  constructor(
    readonly item: CallHierarchyItem, // The call hierarchy item
    readonly locations: Location[] | undefined, // Associated locations, if any
    readonly model: CallHierarchyModel, // Reference to the call hierarchy model
    readonly parent: Call | undefined // Parent call in the hierarchy
  ) {}

  /**
   * Compares two calls based on their URIs and range starts.
   */
  static compare(a: Call, b: Call): number {
    let res = compare(a.item.uri.toString(), b.item.uri.toString())
    if (res === 0) {
      res = Range.compareRangesUsingStarts(a.item.range, b.item.range)
    }
    return res
  }
}

/**
 * DataSource for providing children calls in the call hierarchy.
 */
export class DataSource implements IAsyncDataSource<CallHierarchyModel, Call> {
  constructor(
    public getDirection: () => CallHierarchyDirection // Function to get the direction of calls (incoming/outgoing)
  ) {}

  hasChildren(): boolean {
    return true
  }

  /**
   * Fetches the children of a given call or call hierarchy model.
   */
  async getChildren(element: CallHierarchyModel | Call): Promise<Call[]> {
    if (element instanceof CallHierarchyModel) {
      return element.roots.map((root) => new Call(root, undefined, element, undefined))
    }

    const { model, item } = element

	// TODO: 현재 소스코드와 교체하거나 resolveOutgoing/IncomingCalls 내부만 수정
    // Fetch outgoing or incoming calls based on the direction
    if (this.getDirection() === CallHierarchyDirection.CallsFrom) {
      return (await model.resolveOutgoingCalls(item, CancellationToken.None)).map((call) => {
        return new Call(
          call.to,
          call.fromRanges.map((range) => ({ range, uri: item.uri })),
          model,
          element
        )
      })
    } else {
      return (await model.resolveIncomingCalls(item, CancellationToken.None)).map((call) => {
        return new Call(
          call.from,
          call.fromRanges.map((range) => ({ range, uri: call.from.uri })),
          model,
          element
        )
      })
    }
  }
}

/**
 * Sorter for arranging calls in a consistent order.
 */
export class Sorter implements ITreeSorter<Call> {
  compare(element: Call, otherElement: Call): number {
    return Call.compare(element, otherElement)
  }
}

/**
 * Provides unique identifiers for calls in the hierarchy.
 */
export class IdentityProvider implements IIdentityProvider<Call> {
  constructor(
    public getDirection: () => CallHierarchyDirection // Function to get the direction of calls (incoming/outgoing)
  ) {}

  /**
   * Generates a unique ID for a call, including its parent hierarchy.
   */
  getId(element: Call): { toString(): string } {
    let res =
      this.getDirection() + JSON.stringify(element.item.uri) + JSON.stringify(element.item.range)
    if (element.parent) {
      res += this.getId(element.parent)
    }
    return res
  }
}

/**
 * Template for rendering call elements in the tree.
 */
class CallRenderingTemplate {
  constructor(
    readonly icon: HTMLDivElement,
    readonly label: IconLabel
  ) {}
}

/**
 * Renderer for displaying call hierarchy elements.
 */
// export class CallRenderer implements ITreeRenderer<Call, FuzzyScore, CallRenderingTemplate> {
export class CallRenderer implements ITreeRenderer<Call, CallRenderingTemplate> {
  static readonly id = 'CallRenderer' // Unique ID for this renderer

  templateId: string = CallRenderer.id

  /**
   * Creates a template for rendering.
   */
  renderTemplate(container: HTMLElement): CallRenderingTemplate {
    container.classList.add('callhierarchy-element')
    const icon = document.createElement('div')
    container.appendChild(icon)
    const label = new IconLabel(container, { supportHighlights: true })
    return new CallRenderingTemplate(icon, label)
  }

  /**
   * Renders a specific call element.
   */
  renderElement(
    // node: ITreeNode<Call, FuzzyScore>,
	node: ITreeNode<Call>,
    _index: number,
    template: CallRenderingTemplate
  ): void {
    const { element } = node
    // const deprecated = element.item.tags?.includes(SymbolTag.Deprecated)
    template.icon.className = ''
    // template.icon.classList.add(
    //   'inline',
    //   ...ThemeIcon.asClassNameArray(SymbolKinds.toIcon(element.item.kind))
    // ) // adds Icon depending on type of node
    template.label.setLabel(element.item.name, element.item.detail, {
      labelEscapeNewLines: true,
    //   matches: createMatches(filterData),
    //   strikethrough: deprecated
    })
  }
  /**
   * Disposes of a rendering template.
   */
  disposeTemplate(template: CallRenderingTemplate): void {
    template.label.dispose()
  }
}

/**
 * Delegate for virtual list rendering.
 */
export class VirtualDelegate implements IListVirtualDelegate<Call> {
  /**
   * Returns the height of a single call element.
   */
  getHeight(_element: Call): number {
    return 22
  }

  /**
   * Returns the template ID for a call element.
   */
  getTemplateId(_element: Call): string {
    return CallRenderer.id
  }
}

/**
 * Provides accessibility information for the call hierarchy.
 */
export class AccessibilityProvider implements IListAccessibilityProvider<Call> {
  constructor(public getDirection: () => CallHierarchyDirection) {}

  /**
   * Provides a label for the call hierarchy widget.
   */
  getWidgetAriaLabel(): string {
    return 'tree.aria Call Hierarchy' // localize('tree.aria', "Call Hierarchy")
  }

  /**
   * Provides an ARIA label for a specific call element.
   */
  getAriaLabel(element: Call): string | null {
    if (this.getDirection() === CallHierarchyDirection.CallsFrom) {
      return `from calls from {0} ${element.item.name}` // localize('from', "calls from {0}", element.item.name)
    } else {
      return `to callers of {0} ${element.item.name}` // localize('to', "callers of {0}", element.item.name)
    }
  }
}
