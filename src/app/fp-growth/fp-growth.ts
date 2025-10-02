import { FormsModule } from '@angular/forms';
import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  AfterViewInit,
  Inject,
  OnDestroy,
} from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import * as d3 from 'd3';
import { HierarchyPointLink, HierarchyPointNode } from 'd3-hierarchy';

interface TreeNode {
  name: string;
  count: number;
  children: TreeNode[];
  parent?: TreeNode;
}

@Component({
  selector: 'app-tree-graph',
  templateUrl: './fp-growth.html',
  styleUrls: ['./fp-growth.css'],
  imports: [FormsModule],
  standalone: true,
})
export class FPGrowth implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('treeArea', { static: true }) treeArea!: ElementRef;
  private svg!: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  private width = 640;
  private height = 640;

  @ViewChild('itemInput') itemInput!: ElementRef<HTMLInputElement>;
  transactions: { items: string; count: number }[] = [];
  data: TreeNode = { name: 'root', count: 0, children: [] };

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadFromLocalStorage();
      this.width = this.treeArea.nativeElement.clientWidth || 640;
      this.height = this.treeArea.nativeElement.clientHeight || 640;
    }
  }

  ngAfterViewInit() {
    this.initializeSVG();
    this.onUpdateTree();
  }

  ngOnDestroy() {
    if (isPlatformBrowser(this.platformId)) {
      this.saveToLocalStorage();
    }
  }

  onAddTransaction() {
    this.transactions.push({ items: '', count: 1 });
    this.saveToLocalStorage();
  }

  onRemoveTransaction(i: number) {
    this.transactions.splice(i, 1);
    this.saveToLocalStorage();
    this.onUpdateTree();
  }

  onUpdateTree() {
    this.saveToLocalStorage();

    // Process transactions correctly
    const transactionStrings = this.transactions
      .filter((tx) => tx.items.trim() !== '' && tx.count > 0)
      .flatMap((tx) => Array(tx.count).fill(tx.items.trim()));

    this.data = this.buildFPTree(transactionStrings);
    this.renderTree();
  }

  private saveToLocalStorage(): void {
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.setItem('fp-tree-width', this.width.toString());
        localStorage.setItem('fp-tree-height', this.height.toString());
        localStorage.setItem(
          'fp-tree-transactions',
          JSON.stringify(this.transactions)
        );
      } catch (e) {
        console.error('Failed to save to localStorage', e);
      }
    }
  }

  private loadFromLocalStorage(): void {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const width = localStorage.getItem('fp-tree-width');
        const height = localStorage.getItem('fp-tree-height');
        const transactions = localStorage.getItem('fp-tree-transactions');

        if (width) this.width = parseInt(width, 10);
        if (height) this.height = parseInt(height, 10);
        if (transactions) this.transactions = JSON.parse(transactions);

        if (!transactions || this.transactions.length === 0) {
          this.transactions = [{ items: 'A B C', count: 1 }];
        }
      } catch (e) {
        console.error('Failed to load from localStorage', e);
        this.transactions = [{ items: 'A B C', count: 1 }];
      }
    } else {
      this.transactions = [{ items: 'A B C', count: 1 }];
    }
  }

  private buildFPTree(
    transactions: string[],
    minSupport: number = 1
  ): TreeNode {
    // 1. Calculate item frequencies
    const frequencyMap = new Map<string, number>();
    for (const transaction of transactions) {
      const items = transaction.split(/\s+/).filter(Boolean);
      for (const item of items) {
        frequencyMap.set(item, (frequencyMap.get(item) || 0) + 1);
      }
    }

    // 2. Create frequency-descending order
    const sortedItems = Array.from(frequencyMap.entries())
      .filter(([_, count]) => count >= minSupport)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([item]) => item);

    // 3. Build the FP-Tree
    const root: TreeNode = { name: 'root', count: 0, children: [] };

    for (const transaction of transactions) {
      const items = transaction
        .split(/\s+/)
        .filter((item) => frequencyMap.get(item)! >= minSupport)
        .sort((a, b) => sortedItems.indexOf(a) - sortedItems.indexOf(b));

      let currentNode = root;
      for (const item of items) {
        let child = currentNode.children.find((c) => c.name === item);
        if (!child) {
          child = { name: item, count: 0, children: [], parent: currentNode };
          currentNode.children.push(child);
        }
        child.count++;
        currentNode = child;
      }
    }

    return root;
  }

  private initializeSVG() {
    const container = d3.select<HTMLElement, unknown>(
      this.treeArea.nativeElement
    );
    container.selectAll<SVGElement, unknown>('*').remove();

    const svg = container
      .append<SVGSVGElement>('svg')
      .attr('width', this.width)
      .attr('height', this.height);

    this.svg = svg
      .append<SVGGElement>('g')
      .attr('transform', `translate(0, 0)`);
  }

  private renderTree() {
    if (!this.svg) return;

    const root = d3.hierarchy(this.data);
    const treeLayout = d3
      .tree<TreeNode>()
      .size([this.height - 100, this.width - 100]);
    const treeData = treeLayout(root);
    const nodes = treeData.descendants();

    const minX = d3.min(nodes, (d) => d.x) ?? 0;
    const maxX = d3.max(nodes, (d) => d.x) ?? 0;
    const minY = d3.min(nodes, (d) => d.y) ?? 0;
    const maxY = d3.max(nodes, (d) => d.y) ?? 0;

    const treeWidth = maxY - minY;
    const treeHeight = maxX - minX;

    const horizontalOffset = (this.width - treeWidth) / 2 - minY;
    const verticalOffset = (this.height - treeHeight) / 2 - minX;

    this.svg.selectAll('*').remove();

    this.svg
      .selectAll('.link')
      .data(treeData.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr(
        'd',
        d3
          .linkVertical<
            d3.HierarchyPointLink<TreeNode>,
            d3.HierarchyPointNode<TreeNode>
          >()
          .x((d) => d.x + verticalOffset)
          .y((d) => d.y + horizontalOffset)
      )
      .attr('fill', 'none')
      .attr('stroke', 'var(--color-primary-400)')
      .attr('stroke-width', 2);

    const node = this.svg
      .selectAll('.node')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr(
        'transform',
        (d) => `translate(${d.x + verticalOffset},${d.y + horizontalOffset})`
      );

    node
      .append('circle')
      .attr('r', 8)
      .attr('fill', 'var(--color-primary-500)')
      .attr('stroke', 'var(--color-primary-700)')
      .attr('stroke-width', 2);

    node
      .append('text')
      .attr('dx', (d) => this.getTextPosition(d).x)
      .attr('dy', (d) => this.getTextPosition(d).y)
      .attr('text-anchor', (d) => this.getAnchor(d))
      .attr('fill', 'var(--color-primary-700)')
      .text((d) => `${d.data.name}${d.data.count ? `:${d.data.count}` : ''}`);
  }

  getTextPosition(d: d3.HierarchyPointNode<TreeNode>): {
    x: number;
    y: number;
  } {
    if (d.data.name === 'root') return { x: 0, y: -16 };
    const x = d.children ? -12 : 12;
    const y = d.children ? 16 : 4;
    return { x, y };
  }

  getAnchor(d: d3.HierarchyPointNode<TreeNode>): string {
    if (d.data.name === 'root') return 'middle';
    return d.children ? 'end' : 'start';
  }
}
