/*
 * Copyright 2016 SimplifyOps, Inc. (http://simplifyops.com)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

//= require knockout.min
//= require knockout-mapping
//= require knockout-onenter
//= require ko/binding-url-path-param
//= require ko/binding-message-template
//= require ko/binding-popover
//= require jquery.waypoints.min
//= require menu/project-model

function HomeData(data) {
    var self = this;
    self.baseUrl = data.baseUrl;
    self.summaryUrl = data.summaryUrl;
    self.projectNamesUrl = data.projectNamesUrl;
    self.loaded = ko.observable(data.loaded?true:false);
    self.jobCount = ko.observable(0);
    self.execCount = ko.observable(data.execCount||0);
    self.totalFailedCount = ko.observable(data.totalFailedCount||0);
    self.projectNames = ko.observableArray(data.projectNames || []).extend({ deferred: true });
    self.projectNamesTotal = ko.observable(data.projectNamesTotal || 0);
    self.loadedProjectNames = ko.observable(false);
    self.projects = ko.observableArray([]).extend({ deferred: true })
        .extend({rateLimit: {timeout: 1000, method: "notifyWhenChangesStop"}});
    self.projects.extend({rateLimit: 500});

    self.recentUsers = ko.observableArray(data.recentUsers||[]).extend({ deferred: true });
    self.recentProjects = ko.observableArray(data.recentProjects||[]).extend({ deferred: true });
    self.frameworkNodeName = ko.observable(null);
    self.doRefresh = ko.observable(false);
    self.detailBatchMax = ko.observable(20);
    self.detailBatchDelay = ko.observable(1500);
    self.detailPagingOffset = ko.observable(0);
    self.refreshDelay = ko.observable(30000);
    self.filters = ko.observableArray()
    self.search=ko.observable(null);
    self.pagingOffset=ko.observable(0);
    self.pagingMax=ko.observable(data.pagingMax || 30);
    self.pagingEnabled=ko.observable(data.pagingEnabled?true:false);
    self.opts=ko.observable(data.opts||{});

    //batch of project data to load
    self.processedList=[]
    self.batchList=ko.observableArray([]).extend({ deferred: true });
    self.batchList.extend({ rateLimit: 500 });
    self.batchListChanged = ko.observable(0).extend({ rateLimit: 500 });
    self.batches=ko.observableArray([]).extend({ deferred: true });
    self.log = function (a,b){
        if(data.opts.debug) console.log(a,b);
    }

    self.recentUsersCount = ko.pureComputed(function () {
        return self.recentUsers().length;
    });
    self.recentProjectsCount = ko.pureComputed(function () {
        return self.recentProjects().length;
    });
    self.pageCount=ko.pureComputed(function(){
        let filters = self.enabledFilters();
        let count = filters.length < 1?self.projectNamesTotal():self.searchedProjectsCount()
        return  Math.ceil(count / self.pagingMax())
    });
    self.viewPages=ko.pureComputed(function(){
        let pages = []
        for(let i=0;i<self.pageCount();i++){
            pages.push({
                page:(i+1),
                index:i,
                current:i===self.pagingOffset()
            })
        }
        return pages;
    });
    self.pagedProjects=ko.pureComputed(function (){
        let searched=self.searchedProjects();
        if(!self.pagingEnabled()){
            return searched;
        }
        let count=searched.length;
        let paged=[]
        let start = self.pagingOffset() * self.pagingMax()
        for(let i = start; i < count && i < start + self.pagingMax(); i++){
            paged.push(searched[i])
        }
        return paged;
    }).extend({ deferred: true }).extend({ rateLimit: 500 });
    self.enabledFilters=ko.pureComputed(function(){
        return ko.utils.arrayFilter(self.filters(), function (val) {
            return val.enabled()
        });
    });
    self.searchedProjects=ko.pureComputed(function() {
        "use strict";
        let names = self.projectNames();
        let filters = self.enabledFilters();
        if (filters.length < 1) {
            return names;
        }
        for(let i=0;i<filters.length;i++){
            names = filters[i].filter(names)
        }
        return names;
    });
    self.getSearchFilter=function(){
        return{
            enabled:function(){
                return self.search()!==null;
            },
            filter:function(names){
                let search = self.search()
                let regex
                if (search.charAt(0) === '/' && search.charAt(search.length - 1) === '/') {
                    regex = new RegExp(search.substring(1, search.length - 1),'i');
                }else{
                    //simple match which is case-insensitive, escaping special regex chars
                    regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),'i');
                }
                return ko.utils.arrayFilter(names,function(val,ndx){
                    var proj = self.projectForName(val);
                    var label = proj.label();
                    return val.match(regex) || label && label.match(regex);
                });
            }
        }

    };
    self.searchedProjectsCount = ko.pureComputed(function () {
        return self.searchedProjects().length;
    });
    self.addFilter=function(filter){
        self.filters.push(filter)
    };
    self.projectCount = ko.pureComputed(function () {
        return self.projectNames().length;
    });
    self.projectsByName = ko.pureComputed(function () {
        var obj = {};
        ko.utils.arrayForEach(self.projects(), function (elem, ndx) {
            obj[ko.unwrap(elem.name)] = elem;
        });
        return obj;
    });
    self.searchProjectsByName = ko.pureComputed(function () {
        var obj = {};
        ko.utils.arrayForEach(self.searchedProjects(), function (elem, ndx) {
            obj[ko.unwrap(elem.name)] = elem;
        });
        return obj;
    });
    self.projectInSearch=function(name){
        "use strict";
        return !self.search() || self.searchProjectsByName()[name]!=null;
    };
    self.prototypeProject = new Project({page: 'projectList'});
    self.projectForName = function (name) {
        var projectsByName = self.projectsByName()[name];
        if(null==projectsByName){
            return self.prototypeProject;
        }
        return projectsByName;
    };
    self.mapping = {
        'projects': {
            key: function (data) {
                return ko.utils.unwrapObservable(data.name);
            },
            create: function (data) {
                "use strict";
                return new Project(options.data);
            },
            update: function (options) {
                var updateArray = [];
                var found = options.parent.projectForName(options.data.name);
                if (found) {
                    return ko.mapping.fromJS(options.data, {}, found);
                } else {
                    return ko.mapping.fromJS(options.data, {}, {});
                }
            }
        }
    };
    self.loadSummary = function () {
        return jQuery.ajax({
            type: 'GET',
            contentType: 'json',
            headers: {'x-rundeck-ajax': 'true'},
            url: _genUrl(self.summaryUrl, {}),
            success: function (data, status, jqxhr) {

                ko.mapping.fromJS(data, self.mapping, self);
                self.loaded(true);

                if (self.doRefresh()) {
                    setTimeout(self.loadSummary, self.refreshDelay());
                }
            }
        });
    };
    self.loadProjects = function (projs) {
        for (var i = 0; i < projs.length; i++) {
            var newproj = projs[i];
            var found = self.projectForName(newproj.name);
            if (found && found.name() === newproj.name) {
                ko.mapping.fromJS(newproj, null, found);
                found.loaded(true);
            } else {
                self.projects.push(
                    new Project(jQuery.extend(newproj, {loaded: true, page: 'projectList'}))
                );
            }
        }
    };

    self.setBatchList=function(val){
        self.batchList(val);
        self.batchListChanged(1+self.batchListChanged())
    }
    self.addToBatchList=function(val){
        if(self.processedList.indexOf(val)<0) {
            self.batchList.push(val);
            self.batchListChanged(1 + self.batchListChanged())
        }
    }
    self.pullBatch=function(){
        "use strict";
        //pull up to max number of items from batchList
        let items=self.batchList.splice(0,self.detailBatchMax());
        items = ko.utils.arrayFilter(items,function (i,index){
            return items.indexOf(i)===index &&
                   !homedata.projectForName(i).loaded()
        })
        if(items.length>0) {
            self.batches.push(items);
        }
        if(self.batchList().length>0){
            self.pullBatch()
        }
    };
    self.batchListChanged.subscribe(function(v){
        "use strict";
        setTimeout(self.pullBatch,100);
    });
    self.batches.subscribe(function(newValue){
        if(!self.batchLoading && newValue.length>0){
            self.batchLoading=true;
            setTimeout(self.loadBatch,100);
        }
    });
    self.clearBatchLoad=function(){
        "use strict";

        self.setBatchList([]);
        self.batches([]);
    };
    self.search.subscribe(self.clearBatchLoad);
    self.pagingOffset.subscribe(self.clearBatchLoad);
    self.search.subscribe(function (){
        self.pagingOffset(0)
    });
    self.batchLoading=false;

    self.loadBatch = function () {
        self.batchLoading=true;
        let projects=self.batches.shift();
        projects =ko.utils.arrayFilter(projects,function (a){
            return self.processedList.indexOf(a)<0
        })
        if(null==projects || projects.length<1){
            if(self.batches().length > 0){
                self.loadBatch();
            }else{
                self.batchLoading=false;
            }
            return;
        }
        projects.forEach(function(p){
            self.processedList.push(p)
        })
        var params = {projects:projects.join(',')};//refresh?{refresh:true}:{};
        self.log("loadBatch for: "+projects.length,projects)
        jQuery.ajax({
            type: 'GET',
            contentType: 'json',
            headers: {'x-rundeck-ajax': 'true'},
            url: _genUrl(self.baseUrl, params),
            success: function (data, status, jqxhr) {
                if(self.opts().loadProjectsMode==='full'){
                    if (data.projects) {
                        self.loadProjects(data.projects);
                    }
                }else {
                    processLoadProject(data, 8)
                }
                if(self.batches().length > 0){
                    setTimeout(function(){self.loadBatch();}, self.detailBatchDelay());
                }else{
                    self.batchLoading=false;
                }
            }


        });
    };

    self.addNamesToBatch=function(list){
        list.forEach(homedata.addToBatchList)
    }
    /**
     * bound via the ko/binding-waypoints knockout binding
     * example:
     * &lt;span data-bind="waypoints: $root.waypointHandler" &gt;
     */
    self.waypointHandler=function(){
        "use strict";
        var projectName = jQuery(this.element).data('project');
        self.addNamesToBatch([projectName])
        this.destroy();
    };
    //initial setup
    self.beginLoad = function () {

        if (self.doRefresh()) {
            setTimeout(self.loadSummary, self.refreshDelay());
        }
    };
    self.loadProjectNames = function () {
        jQuery.ajax({
            type: 'GET',
            contentType: 'json',
            headers: {'x-rundeck-ajax': 'true'},
            url: _genUrl(self.projectNamesUrl, {}),
            success: function (data, status, jqxhr) {

                if(self.opts().loadProjectsMode === 'full') {
                    self.projectNames(data.projectNames)
                    self.projectNamesTotal(data.projectNames.length)
                    self.loadedProjectNames(true)
                }else{
                    //incrementally add names to the list
                    self.projectNames.removeAll();
                    processProjectNames(data.projectNames, 150);
                    self.projectNamesTotal(data.projectNames.length);
                }
            }
        });
    };
    self.init = function () {
        if(self.opts().waypoints) {
            //load project details via waypoints when scrolled into view
            self.pagedProjects.subscribe(function (val) {
                "use strict";
                //when search results change, refresh waypoints
                ko.tasks.schedule(function () {
                    initWaypoints(self, true);
                });
            });
            if (self.loadedProjectNames()) {
                //load waypoints manually
                initWaypoints(self);
            }
            self.loaded.subscribe(Waypoint.refreshAll);
            self.projects.subscribe(Waypoint.refreshAll);
            self.pagingOffset.subscribe(function (val) {
                "use strict";
                //when search results change, refresh waypoints
                ko.tasks.schedule(function () {
                    initWaypoints(self, true);
                });
            });
        }else{
            //load details for paged results right away
            self.pagedProjects.subscribe(function(s){
                self.addNamesToBatch(s)
            });
            if (self.loadedProjectNames()) {
                //load waypoints manually
                self.addNamesToBatch(self.pagedProjects())
            }
        }
        self.addFilter(self.getSearchFilter());
        self.beginLoad();
        if (self.projectCount() != self.projectNamesTotal()) {
            self.loadProjectNames();
        }
    };
}

function processProjectNames(data, count){
    let newData= data.slice();

    if(newData.length == 0) {
        homedata.loadedProjectNames(true);
        return
    }

    if(newData.length < count){
        count = newData.length;
    }

    for (var i = 0; i < count; i++) {
        homedata.projectNames.push(newData[i]);
    }

    newData.splice(0,count);
    setTimeout(function(){processProjectNames(newData, count);}, 50 );
}

function processLoadProject(data, count){
    let newData = data;
    if(newData.projects && newData.projects.length == 0) return

    var projToProcess = newData.projects.splice(0,count+1);
    homedata.loadProjects(projToProcess);

    setTimeout(function(){processLoadProject(newData, count);}, 0 );
}

var _waypointBatchTimer;
function batchInitWaypoints(arr,handler,count){
    "use strict";
    var arr2=arr.splice(0,count);
    if(arr2.length>0) {
        jQuery(arr2).waypoint(handler, {context:'#main-panel',offset: '100%'});
        if (arr.length > 0) {
            _waypointBatchTimer=setTimeout(function(){batchInitWaypoints(arr, handler,count);}, 500);
        }
    }
}
function initWaypoints(homedata,reset){
    "use strict";
    if(reset){
        if(_waypointBatchTimer){
            clearTimeout(_waypointBatchTimer);
            _waypointBatchTimer=null;
        }
        Waypoint.destroyAll();
    }

    batchInitWaypoints(jQuery('.project_list_item[data-project]'),homedata.waypointHandler,50);
}

/**
 * START page init
 */
var homedata;
function init() {
    // ko.options.deferUpdates = true;
    var pageparams = loadJsonData('homeDataPagingParams') || {};
    var projectNamesData = loadJsonData('projectNamesData');
    if (projectNamesData.projectNames == null) {
        projectNamesData.projectNames = [];
    }
    var statsdata = loadJsonData('statsData') || {};
    homedata = new HomeData(jQuery.extend({
        baseUrl: appLinks.menuHomeAjax,
        summaryUrl: appLinks.menuHomeSummaryAjax,
        projectNamesUrl: appLinks.menuProjectNamesAjax,
        projectNames: projectNamesData.projectNames.sort(),
        projectNamesTotal: projectNamesData.projectNamesTotal || 0,
        pagingEnabled: pageparams.pagingEnabled,
        pagingMax: pageparams.pagingMax
    },statsdata,{opts:{waypoints:true, loadProjectsMode:'full', debug:false}}));
    homedata.loadedProjectNames(projectNamesData.projectNames.length === projectNamesData.projectNamesTotal);
    ko.applyBindings(homedata);

    //todo: move init values into HomeData
    homedata.detailBatchMax(pageparams.detailBatchMax || 15);
    homedata.doRefresh(pageparams.summaryRefresh != null ? pageparams.summaryRefresh : true);
    homedata.refreshDelay(pageparams.refreshDelay || 60000);
    homedata.detailBatchDelay(pageparams.detailBatchDelay || 1000);

    homedata.init();
}
jQuery(init);
