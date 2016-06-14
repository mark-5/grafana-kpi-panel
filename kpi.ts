///<reference path="../../../public/app/headers/common.d.ts" />

import $ from 'jquery';
import _ from 'lodash';
import kbn from 'app/core/utils/kbn';
import {DashboardModel}  from './models/dashboard';
import {PanelModel}      from './models/panel';
import {KPIRenderer}     from './renderer';
import {PanelCtrl}       from 'app/plugins/sdk';

export class KPICtrl extends PanelCtrl {
  static templateUrl = 'partials/module.html';

  backendSrv:    any;
  datasourceSrv: any;
  templateSrv:   any;
  timeSrv:       any;
  $location:     any;

  data:             Promise<any[]>;
  dashboards:       Promise<DashboardModel[]>;
  dashboardOptions: Promise<Object[]>;

  panelDefaults = {
    targets: []
  };

  loading:    boolean;
  interval:   any;
  range:      any;
  rangeRaw:   any;
  resolution: any;

  /** @ngInject */
  constructor($scope, $injector) {
    super($scope, $injector);
    _.defaults(this.panel, this.panelDefaults);

    this.backendSrv    = $injector.get('backendSrv');
    this.datasourceSrv = $injector.get('datasourceSrv');
    this.templateSrv   = $injector.get('templateSrv');
    this.timeSrv       = $injector.get('timeSrv');
    this.$location     = $injector.get('$location');

    this.events.on( 'init-edit-mode', this.onInitEditMode.bind(this) );
    this.events.on( 'refresh',        this.onRefresh.bind(this)      );
    this.events.on( 'data-received',  this.render.bind(this)         );
  };

  onInitEditMode() {
    this.addEditorTab('Options', 'public/plugins/grafana-kpi-panel/partials/editor.html');
    this.editorTabIndex = 1;
  };

  onRefresh(dataList) {
    this.dashboards       = this.getDashboards();
    this.dashboardOptions = this.getDashboardOptions();

    var selected = this.dashboards.then(dashboards => {
        var ids = _.chain(this.panel.targets)
          .filter(  target => { return !target.hide;     })
          .groupBy( target => { return target.dashboard; })
          .value();
        return _.filter(dashboards, dash => { return _.has(ids, dash.id); });
    });

    this.data = selected
      .then( this.queryDashboards.bind(this)   )
      .then( this.handleQueryResult.bind(this) );

    this.loading = true;
    this.data
      .then( this.events.emit.bind(this.events, 'data-received') )
      .then( _ => { this.loading = false } );
  };

  getDashboards() {
    if (this.dashboards) { return this.dashboards; };

    return this.backendSrv.search({}).then(dashboards => {
      var promises = _.map(dashboards, dash => {
        var parts = dash.uri.split('/', 2);
        return this.backendSrv.getDashboard(parts[0], parts[1])
          .then(dashboard => {
            return new DashboardModel(dashboard);
          });
      });
      return Promise.all(promises);
    });
  };

  getDashboardOptions() {
    if (this.dashboardOptions) { return this.dashboardOptions; };

    return this.getDashboards().then(dashboards => {
        return _.map(dashboards, d => { return {name: d.title, value: d.id}; });
    });
  };

  getData() {
    return this.data ? this.data : Promise.resolve([]);
  };

  updateTimeRange() {
    this.range      = this.timeSrv.timeRange();
    this.rangeRaw   = this.timeSrv.timeRange(false);
    this.resolution = Math.ceil($(window).width() * (this.panel.span / 12));
    this.interval   = kbn.calculateInterval(this.range, this.resolution);
  };

  lastNonNull(datapoints) {
    for (let i = datapoints.length - 1; i >= 0; i--) {
      var datapoint = datapoints[i];
      if (!_.isNull(datapoint[0])) { return datapoint[0]; }
    }
    return null;
  };

  handleQueryResult(results) {
    return this.getDashboards().then(dashboards => {
      var data = [];

      for(let result of results) {
        if (!(result && result.data)) { continue; }

        var dashboard = _.find(dashboards,  {uid: result.dashboard});
        if (!dashboard) { continue; }

        var panel = _.find(dashboard.panels, {uid: result.panel});
        if (!panel) { continue; }

        var panelState  = 0;
        var panelValues = {};
        for (let datum of result.data) {
          if (!datum && datum.datapoints) { continue; }
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
    });
  };

  queryDashboards(dashboards: DashboardModel[]) {
    var promises = [];

    _.each(dashboards, dashboard => {
      _.each(dashboard.panels, panel => {
        if (!panel.targets) { return; }

        var datasource = panel.datasource;
        var targets    = panel.targets;
        var scopedVars = this.getScopedVars(panel, dashboard);
        var params     = {dashboard: dashboard.uid, panel: panel.uid};

        var query = this.issueQueries(datasource, targets, scopedVars)
          .then(result => { return _.extend({}, result, params); });

        promises.push(query);
      });
    });

    return Promise.all(promises);
  };

  getScopedVars(panel: PanelModel, dashboard: DashboardModel) {
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

  issueQueries(datasourceName: string, targets: Object[], scopedVars: Object) {
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

      this.getData().then(data => {
        if (data && data.length) {
          ctrl.calculatePanelHeight();
          var height = ctrl.height;
          var width  = $(container[0]).width();
          renderer.render(data, height, width);
        }
        ctrl.renderingCompleted();
      });

    });

    this.events.on('$destroy', () => {
      renderer.remove();
    });
  }

}
