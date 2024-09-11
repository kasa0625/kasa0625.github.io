class MinHeap {
    constructor() {
      this.heap = [];
    }
  
    swap(i, j) {
      [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
    }
  
    heapifyUp(index) {
      while (index > 0 && this.heap[index].total < this.heap[Math.floor((index - 1) / 2)].total) {
        this.swap(index, Math.floor((index - 1) / 2));
        index = Math.floor((index - 1) / 2);
      }
    }
  
    heapifyDown(index, heapSize) {
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      let smallest = index;
  
      if (left < heapSize && this.heap[left].total < this.heap[smallest].total) {
        smallest = left;
      }
  
      if (right < heapSize && this.heap[right].total < this.heap[smallest].total) {
        smallest = right;
      }
  
      if (smallest !== index) {
        this.swap(index, smallest);
        this.heapifyDown(smallest, heapSize);
      }
    }
  
    insert(val) {
      this.heap.push(val);
      this.heapifyUp(this.heap.length - 1);
    }
  
    removeMin() {
      if (this.heap.length === 0) {
        return null;
      }
  
      const min = this.heap[0];
      this.heap[0] = this.heap[this.heap.length - 1];
      this.heap.pop();
      this.heapifyDown(0, this.heap.length);
      return min;
    }
  
    size() {
      return this.heap.length;
    }
  }