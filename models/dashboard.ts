///<reference path="../../../../public/app/headers/common.d.ts" />
import _       from 'lodash';
import {PanelModel} from './panel';

export class DashboardModel {
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
