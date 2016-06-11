///<reference path="../../../public/app/headers/common.d.ts" />

import $ from 'jquery';
import _ from 'lodash';
import kbn from 'app/core/utils/kbn';
import {KPIRenderer} from './renderer';
import {PanelCtrl}   from 'app/plugins/sdk';
import './css/styles.css!';

class DashboardModel {

  id:          number;
  panels:      PanelModel[];
  templating:  Object;
  title:       string;
  uid:         string;
  uri:         string;

  constructor(dashboard: Object) {
    this.id         = dashboard['dashboard']['id'];
    this.templating = dashboard['dashboard']['templating'];
    this.title      = dashboard['dashboard']['title'];
    this.uid        = _.uniqueId();

    var uri = '/dashboard';
    uri    += '/'+dashboard['meta']['type'];
    uri    += '/'+dashboard['meta']['slug'];
    this.uri = uri;

    var panels = this.panels = [];
    for (let row of dashboard['dashboard']['rows']) {
      for (let panel of row['panels']) {
        var model = new PanelModel(panel);
        if (!model.thresholds) { continue; }
        panels.push(model);
      }
    }
  };

};

class PanelModel {

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

class KPICtrl extends PanelCtrl {
  static templateUrl = 'module.html';

  backendSrv:         any;
  dashboardSrv:       any;
  datasourceSrv:      any;
  templateSrv:        any;
  timeSrv:            any;
  $location:          any;

  data: any;
  private dashboards: DashboardModel[];

  dashboard:        Object;
  dashboardOptions: Object[];
  panelDefaults = {};

  interval:   any;
  range:      any;
  rangeRaw:   any;
  resolution: any;

  /** @ngInject */
  constructor($scope, $injector) {
    super($scope, $injector);
    _.defaults(this.panel, this.panelDefaults);

    this.backendSrv    = $injector.get('backendSrv');
    this.dashboardSrv  = $injector.get('dashboardSrv');
    this.datasourceSrv = $injector.get('datasourceSrv');
    this.templateSrv   = $injector.get('templateSrv');
    this.timeSrv       = $injector.get('timeSrv');
    this.$location     = $injector.get('$location');

    this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
    this.events.on('refresh', this.onRefresh.bind(this));
    this.events.on('data-received', data => {
      this.data = data;
      this.render();
    });
  };

  private onInitEditMode() {
    this.addEditorTab('Options', 'public/plugins/grafana-kpi-panel/editor.html');
    this.editorTabIndex = 1;
  };

  private onRefresh(dataList) {
    var dashboards = this.getDashboards();
    dashboards.then(dashboards => {
      this.dashboards = dashboards;
      this.dashboardOptions = _.map(dashboards, d => { return {id: d.id, title: d.title}; });
    });

    var selected ;
    if (this.panel.dashboard) {
      var want = this.panel.dashboard;
      selected = dashboards.then(dashboards => {
        return _.where(dashboards, {id: want});
      });
    }
    if (!selected) { return; }

    var queries = this.queryDashboards(selected);
    var data    = queries.then(this.handleQueryResult.bind(this));
    data.then(data => {
      this.events.emit('data-received', data);
    });
  };

  private getDashboards() {
    var self = this;

    var dashboards = self.backendSrv.search({}).then(dashboards => {
      var promises = _.map(dashboards, dash => {
        var parts = dash.uri.split('/', 2);
        return self.backendSrv.getDashboard(parts[0], parts[1])
          .then(dashboard => {
            return new DashboardModel(dashboard);
          });
      });
      return Promise.all(promises);
    });

    return dashboards;
  };

  private updateTimeRange() {
    this.range      = this.timeSrv.timeRange();
    this.rangeRaw   = this.timeSrv.timeRange(false);
    this.resolution = Math.ceil($(window).width() * (this.panel.span / 12));
    this.interval   = kbn.calculateInterval(this.range, this.resolution);
  };

  private lastNonNull(datapoints) {
    for (let i = datapoints.length - 1; i >= 0; i--) {
      var datapoint = datapoints[i];
      if (!_.isNull(datapoint[0])) { return datapoint[0]; }
    }
    return null;
  };

  private handleQueryResult(results) {
    var data = [];

    for (let result of results) {
      if (!(result && result.data)) { continue; }
      var dashboard = _.find(this.dashboards,  {uid: result.dashboard});
      if (!dashboard) { continue; }
      var panel = _.find(dashboard.panels, {uid: result.panel});
      if (!panel) { continue; }

      var panelState  = 0;
      var panelValues = {};
      for (let datum of result.data) {
        if (!datum && datum.datapoints) { return; }
          var value = this.lastNonNull(datum.datapoints);
          var state = panel.getThresholdState(value);
          if (!panelValues[state]) { panelValues[state] = []; }
          panelValues[state].push({value: value, target: datum.target});
          if (state > panelState) { panelState = state; }
      }

      var scopedVars  = this.getScopedVars(panel, dashboard);
      var templateSrv = this.templateSrv;
      data.push({
        dashboard:  templateSrv.replace(dashboard.title, scopedVars),
        panel:      templateSrv.replace(panel.title, scopedVars),
        state:      panelState,
        values:     panelValues,
        thresholds: _.clone(panel.thresholds),
        uri:        dashboard.uri+'?panelId='+panel.id+'&fullscreen',
      });
    }

    return data;
  };

  private queryDashboards(dashboards: Promise<DashboardModel[]>) {
    var self = this;

    var queries = dashboards.then(dashboards => {
      var promises = [];
      _.each(dashboards, dashboard => {
        _.each(dashboard.panels, panel => {
          if (!panel.targets) { return; }

          var datasource = panel.datasource;
          var targets    = panel.targets;
          var scopedVars = self.getScopedVars(panel, dashboard);
          var params     = {dashboard: dashboard.uid, panel: panel.uid};

          var query = self.issueQueries(datasource, targets, scopedVars)
            .then(result => { return _.extend({}, result, params); });

          promises.push(query);
        });
      });
      return Promise.all(promises);
    });

    return queries;
  };

  private getScopedVars(panel: PanelModel, dashboard: DashboardModel) {
    var templateSrv = this.templateSrv;

    var dashboardScopedVars = {};
    for (let variable of dashboard.templating['list']) {
      var name  = variable.name;
      var value = variable.current;
      if (!value) { continue; }
      if (templateSrv.isAllValue(value.value)) {
        value = _.extend({}, value, {value: templateSrv.getAllValue(variable)});
      }
      dashboardScopedVars[name] = value;
    }

    return _.extend({}, dashboardScopedVars, panel.scopedVars || {});
  };

  private issueQueries(datasourceName: string, targets: Object[], scopedVars: Object) {
    this.updateTimeRange();

    var metricsQuery = {
      panelId:       this.panel.id,
      range:         this.range,
      rangeRaw:      this.rangeRaw,
      interval:      this.interval,
      targets:       targets,
      format:        'json',
      maxDataPoints: this.resolution,
      scopedVars:    scopedVars,
      cacheTimeout:  this.panel.cacheTimeout,
    };

    return this.datasourceSrv.get(datasourceName)
      .then(datasource => {
        return datasource.query(metricsQuery);
      });
  };

  link(scope, elem, attrs, ctrl) {
    var container = elem.find('.kpi-container');
    var $location = this.$location;
    var $timeout  = this.$timeout;

    var renderer = new KPIRenderer(container, $location, $timeout);
    this.events.on('render', () => {
      if (this.data) {
        ctrl.calculatePanelHeight();
        var height = this.containerHeight;
        var width  = $(container[0]).width();
        renderer.render(this.data, height, width);
      }
      ctrl.renderingCompleted();
    });
    this.events.on('$destroy', () => {
      renderer.remove();
    });
  }

}

export {KPICtrl as PanelCtrl};
