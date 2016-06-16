///<reference path="../../../public/app/headers/common.d.ts" />
import angular from 'angular';
import _ from 'lodash';

export class KPIVariableCtrl {
  index:     any;
  panelCtrl: any;
  target:    any;
  variable:  any;

  variableNameSegment:  any;
  uiSegmentSrv: any;

  constructor($injector) {
    this.uiSegmentSrv = $injector.get('uiSegmentSrv');
    this.variable = {current: {text: 'select value'}, options: [{text: 'select value'}]};
    this.variableNameSegment  = this.uiSegmentSrv.newSegment({fake: true, value: 'select variable'});
  };

  getVariableNames() {
    var uiSegmentSrv = this.uiSegmentSrv;
    return this.panelCtrl.getDashboards()
      .then(dashboards => {
        var dashboard = _.findWhere(dashboards, {id: this.target.dashboard});
        return this.panelCtrl.getScopedVars(null, dashboard);
      })
      .then(scopedVars => {
        var varNames = _.keys(scopedVars);
        return _.map(varNames, varName => { return uiSegmentSrv.newSegment(varName); });
      });
  };

  getVariableValues() {
    var uiSegmentSrv = this.uiSegmentSrv;
    var variableName = this.variableNameSegment.value;
    return this.panelCtrl.getDashboards()
      .then(dashboards => {
        var dashboard = _.findWhere(dashboards, {id: this.target.dashboard});
        return _.findWhere(dashboard.templating.list, {name: variableName});
      })
      .then(variable => {
        return _.map(variable.options, option => { return uiSegmentSrv.newSegment(option.text); });
      });
  };

  setVariableName() {
    var variableName = this.variableNameSegment.value;
    this.panelCtrl.getDashboards()
      .then(dashboards => {
        var dashboard = _.findWhere(dashboards, {id: this.target.dashboard});
        return _.findWhere(dashboard.templating.list, {name: variableName});
      })
      .then(variable => {
        this.variable = variable;
      });
  };

  updateVariable() {
    var variable = this.target.scopedVars[this.index];
    variable.name  = this.variableNameSegment.value;
    variable.value = this.variable.current.value;
  };

  removeVariable() {
    this.target.scopedVars.splice(this.index, 1);
  };

};

var module = angular.module('grafana.directives');
module.directive('kpiVariable', () => {
  return {
    bindToController: true,
    controller:       KPIVariableCtrl,
    controllerAs:     'ctrl',
    restrict:         'E',
    templateUrl:      'public/plugins/grafana-kpi-panel/partials/query.variable.html',
    scope: {index: '=', panelCtrl: '=', target: '='},
  };
});
