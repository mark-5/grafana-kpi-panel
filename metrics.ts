///<reference path="../../../public/app/headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';

export class KPIDsSelectorCtrl {
  dsSegment:    any;
  events:       any;
  panelCtrl:    any;
  uiSegmentSrv: any;

  /** @ngInject */
  constructor($injector) {
    this.uiSegmentSrv = $injector.get('uiSegmentSrv');
    this.dsSegment = this.uiSegmentSrv.newSegment({fake: true, value: 'select dashboard'});
  };

  addDashboard(option) {
    this.panelCtrl.getDashboardOptions().then(options => {
      var selected = _.findWhere(options, {name: option.value});
      if (!selected) { return; }

      var panelCtrl = this.panelCtrl;
      var panel     = panelCtrl.panel;

      var refId  = panelCtrl.dashboard.getNextQueryLetter(panel);
      var target = {refId: refId, dashboard: selected.value};
      panel.targets.push(target);
      panelCtrl.refresh();
    });
  };

  getOptions() {
    var uiSegmentSrv = this.uiSegmentSrv;
    return this.panelCtrl.getDashboardOptions().then(options => {
      return _.map(options, option => { return uiSegmentSrv.newSegment(option.name); });
    });
  };

};

var module = angular.module('grafana.directives');
module.directive('kpiDsSelector', () => {
  return {
    bindToController: true,
    controller:       KPIDsSelectorCtrl,
    controllerAs:     'ctrl',
    scope:            {panelCtrl: '='},
    templateUrl:      'public/plugins/grafana-kpi-panel/partials/ds_selector.html',
    restrict:         'E'
  };
});
