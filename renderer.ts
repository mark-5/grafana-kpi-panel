///<reference path="../../../public/app/headers/common.d.ts" />
///<reference path="./lib/d3.d.ts" />

import $  from 'jquery';
import _  from 'lodash';
import d3 from './lib/d3';

class KPITooltip {
  $location: any;
  $timeout:  any;

  elem: any;

  constructor($location, $timeout) {
    this.$location = $location;
    this.$timeout  = $timeout;
  };

  getElem() {
    if (this.elem) { return this.elem; }
    return this.elem = $('<div id="tooltip" class="graph-tooltip">');
  };

  removeElem() {
    if (this.elem) {
      this.elem.remove();
      this.elem = null;
    }
  };

  render(d) {
    var state     = d.state;
    var stateDesc = ['OK', 'WARNING', 'CRITICAL'];

    var cmp = d.thresholds.reversed ? 'min' : 'max';
    var metric = _[cmp](d.values[state], m => { return m.value; });

    var table = [
      ['Name', d.panel],
      ['State', stateDesc[state]],
      ['Target', metric.target],
      ['Thresholds', 'warning='+d.thresholds.warning+', '+'critical='+d.thresholds.critical],
      ['Value', metric.value]
    ];

    var template = _.template(''
      + '<% _.each(table, function(row) { %>'
      +   '<div class="kpi-list-item">'
      +     '<div class="kpi-field-name">  <%= row[0] %> </div>'
      +     '<div class="kpi-field-value"> <%= row[1] %> </div>'
      +   '</div>'
      + '<% }) %>'
    );
    return this.getElem().html(template({table: table}));
  };

  onMouseover(d) {
    return this.render(d);
  };

  onMousemove(d) {
    return this.getElem().place_tt(d3.event.pageX + 20, d3.event.pageY);
  };

  onMouseout(d) {
    return this.removeElem();
  };

  onClick(d) {
    var self = this;
    return self.$timeout(() => {
      self.removeElem();
      self.$location.url(d.uri);
    });
  };

  remove() {
    this.removeElem();
  };
};

export class KPIRenderer {
  colors = ['green', 'orange', 'red'];

  root:   any;
  private tooltip: KPITooltip;

  $location: any;
  $timeout:  any;

  constructor(root, $location, $timeout) {
    this.root      = root;
    this.$location = $location;
    this.$timeout  = $timeout;

  };

  distributeCells(data, height, width) {
    var nearestRoot = Math.ceil(Math.sqrt(data.length));
    var rows = Math.ceil(nearestRoot * (height / width));
    var cols = Math.ceil(nearestRoot * (width  / height));

    var curRow = 0, curCol = 0;
    var cells = _.map(data, datum => {
      var cell = _.extend({}, datum, {row: curRow, col: curCol});
      if (curCol === cols - 1) {
        curCol = 0;
        curRow += 1;
      } else {
        curCol += 1;
      }
      return cell;
    });

    return {
      cells: cells,
      rows:  rows,
      cols:  cols,
      size:  Math.min((height / rows), (width / cols)),
    };
  };

  render(data, height, width) {
    var self = this;
    this.remove();

    var distribution = this.distributeCells(data, height, width);
    var gridSize     = distribution.size;
    var colors = this.colors;

    var kpi = d3.select(this.root[0])
      .append('svg')
        .attr('width',   d => { return '100%'; })
        .attr('height',  d => { return '100%'; })
      .append('g')
      .selectAll('.heatmap')
      .data(distribution.cells, d => { return d.col + ':' + d.row; })
      .enter().append('svg:rect')
        .attr('x',       d => { return d.col * gridSize; })
        .attr('y',       d => { return d.row * gridSize; })
        .attr('width',   d => { return gridSize;         })
        .attr('height',  d => { return gridSize;         })
        .style('fill',   d => { return colors[d.state];  });

    var tooltip = this.tooltip = new KPITooltip(this.$location, this.$timeout);
    kpi
      .on('mouseover', tooltip.onMouseover.bind(tooltip))
      .on('mousemove', tooltip.onMousemove.bind(tooltip))
      .on('mouseout',  tooltip.onMouseout.bind(tooltip))
      .on('click',     tooltip.onClick.bind(tooltip));
  };

  remove() {
    if (this.tooltip) {
      this.tooltip.remove();
    }
    if (this.root) {
      this.root.empty();
    }
  };
};
