///<reference path="../../../../public/app/headers/common.d.ts" />
import _ from 'lodash';

export class PanelModel {

  datasource: string;
  id:         number;
  scopedVars: Object;
  targets:    Object[];
  thresholds: Object;
  title:      string;
  uid:        string;

  constructor(panel: Object) {
    this.datasource = panel['datasource'];
    this.id         = panel['id'];
    this.scopedVars = panel['scopedVars'];
    this.targets    = panel['targets'];
    this.title      = panel['title'];
    this.uid        = _.uniqueId();

    this.thresholds = this.getThresholds(panel);
  };

  getThresholds(panel: Object) {
    var values = [];

    var panelType = panel['type'];
    if (panelType === 'graph') {
      var grid = panel['grid'];
      if (!(grid.threshold1 && grid.threshold2)) { return null; }
      values = [grid.threshold1, grid.threshold2];
    } else if (panelType === 'singlestat') {
      if (!panel['thresholds']) { return null; }
      values = panel['thresholds'].split(',');
    } else if (panelType === 'table') {
      // TODO: support tables
      return null;
    } else {
      return null;
    }

    var thresholds = {};
    if (values[0] < values[1]) {
      thresholds['reversed'] = false;
      thresholds['warning']  = values[0];
      thresholds['critical'] = values[1];
    } else {
      thresholds['reversed'] = true;
      thresholds['warning']  = values[1];
      thresholds['critical'] = values[0];
    }

    return thresholds;
  };

  getThresholdState(value: number) {
    if (!this.thresholds) { return 0; }

    if (this.isCritical(value)) {
      return 2;
    } else if (this.isWarning(value)) {
      return 1;
    } else {
      return 0;
    }
  }

  isWarning(value: number) {
    var thresholds = this.thresholds;
    if (!thresholds) { return false; }

    if (thresholds['reversed']) {
      return value <= thresholds['warning'];
    } else {
      return value >= thresholds['warning'];
    }
  };

  isCritical(value: number) {
    var thresholds = this.thresholds;
    if (!thresholds) { return false; }

    if (thresholds['reversed']) {
      return value <= thresholds['critical'];
    } else {
      return value >= thresholds['critical'];
    }
  };

};
