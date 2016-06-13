///<reference path="../../../public/app/headers/common.d.ts" />
import angular from 'angular';
import _ from 'lodash';

export class KPIQueryCtrl {

  panelCtrl:  any;
  target:     any;
  targetName: any;

  constructor($scope, $injector) {
    this.getTargetName();
  };

  getTargetName() {
    return this.panelCtrl.getDashboardOptions().then(options => {
      if (!this.target) { return; }
      var option = _.findWhere(options, {value: this.target.dashboard});

      if (!option) { return; }
      this.targetName = option.name;
    });
  };

};

var module = angular.module('grafana.directives');
module.directive('kpiQuery', () => {
  return {
    bindToController: true,
    controller:       KPIQueryCtrl,
    controllerAs:     'ctrl',
    scope:            {panelCtrl: '=', target: '='},
    templateUrl:      'public/plugins/grafana-kpi-panel/partials/query.editor.html',
    restrict:         'E'
  };
});
