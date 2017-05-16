define(['angular',"feed-mgr/templates/module-name"], function (angular,moduleName) {

    var directive = function () {
        return {
            restrict: "EA",
            require: ['thinkbigRegisterSelectTemplate', '^thinkbigStepper'],
            bindToController: {
                stepIndex: '@',
                nifiTemplateId:'=?',
                registeredTemplateId:"=?"
            },
            scope: {},
            controllerAs: 'vm',
            templateUrl: 'js/feed-mgr/templates/template-stepper/select-template/select-template.html',
            controller: "RegisterSelectTemplateController",
            link: function ($scope, element, attrs, controllers) {
                var thisController = controllers[0];
                var stepperController = controllers[1];
                thisController.stepperController = stepperController;
                if(thisController && thisController.isLoading()){
                    stepperController.showProgress = true;
                }
            }

        };
    }

    var controller = function ($scope, $http, $mdDialog, $mdToast, $timeout, $q,RestUrlService, RegisterTemplateService, StateService, AccessControlService,EntityAccessControlService) {

        var self = this;

        this.templates = [];
        this.model = RegisterTemplateService.model;
        this.stepNumber = parseInt(this.stepIndex) + 1

        this.template = null;
        this.stepperController = null;

        this.registeredTemplateId = this.model.id;
        this.nifiTemplateId = this.model.nifiTemplateId;

        this.isValid = this.registeredTemplateId !== null;

        /**
         * Error message to be displayed if {@code isValid} is false
         * @type {null}
         */
        this.errorMessage = null;

        /**
         * Indicates if admin operations are allowed.
         * @type {boolean}
         */
        self.allowAdmin = false;

        /**
         * Indicates if edit operations are allowed.
         * @type {boolean}
         */
        self.allowEdit = false;

        /**
         * Flag to indicate the template is loading
         * Used for PRogress
         * @type {boolean}
         */
        self.loadingTemplate = false;

        /**
         * Flag to indicate the select template list is loading
         * @type {boolean}
         */
        self.fetchingTemplateList = false;

        function showProgress() {
            if (self.stepperController) {
                self.stepperController.showProgress = true;
            }
        }


        function hideProgress() {
            if (self.stepperController && !self.isLoading()) {
                self.stepperController.showProgress = false;
            }
        }

        function findSelectedTemplate() {
            if (self.nifiTemplateId != undefined) {
                return _.find(self.templates, function (template) {
                    return template.id == self.nifiTemplateId;
                });
            }
            else {
                return null;
            }
        }

        this.isLoading = function(){
            return self.loadingTemplate || self.fetchingTemplateList || self.model.loading;
        }

        /**
         * Gets the templates for the select dropdown
         * @returns {HttpPromise}
         */
        this.getTemplates = function () {
            self.fetchingTemplateList = true;
            showProgress();
            RegisterTemplateService.getTemplates().then(function (response) {
                self.templates = response.data;
                self.fetchingTemplateList = false;
                hideProgress();
            });
        };

        this.changeTemplate = function () {
            self.errorMessage = null;
            self.loadingTemplate = true;
            showProgress();
            //Wait for the properties to come back before allowing hte user to go to the next step
            var selectedTemplate = findSelectedTemplate();
            var templateName = null;
            if (selectedTemplate != null && selectedTemplate != undefined) {
                templateName = selectedTemplate.name;
            }
            RegisterTemplateService.loadTemplateWithProperties(null, self.nifiTemplateId, templateName).then(function (response) {

                RegisterTemplateService.warnInvalidProcessorNames();
                $q.when(RegisterTemplateService.checkTemplateAccess()).then(function(response) {
                    self.isValid = response.isValid;
                    self.allowAdmin = response.allowAdmin;
                    self.allowEdit = response.allowEdit;
                    if(!response.isValid) {
                        //PREVENT access
                        self.errorMessage ="Access Denied.  You are unable to edit the template. ";
                    }
                        self.loadingTemplate = false;
                        hideProgress();
                });


            });
        }

        this.disableTemplate = function () {
            if (self.model.id) {
                RegisterTemplateService.disableTemplate(self.model.id)
            }
        }

        this.enableTemplate = function () {
            if (self.model.id) {
                RegisterTemplateService.enableTemplate(self.model.id)
            }
        }

        function deleteTemplateError(errorMsg) {
            // Display error message
            var msg = "<p>The template cannot be deleted at this time.</p><p>";
            msg += angular.isString(errorMsg) ? _.escape(errorMsg) : "Please try again later.";
            msg += "</p>";

            $mdDialog.hide();
            $mdDialog.show(
                $mdDialog.alert()
                    .ariaLabel("Error deleting the template")
                    .clickOutsideToClose(true)
                    .htmlContent(msg)
                    .ok("Got it!")
                    .parent(document.body)
                    .title("Error deleting the template"));
        }

        this.deleteTemplate = function () {
            if (self.model.id) {

                RegisterTemplateService.deleteTemplate(self.model.id).then(function (response) {
                    if (response.data && response.data.status == 'success') {
                        self.model.state = "DELETED";

                        $mdToast.show(
                            $mdToast.simple()
                                .textContent('Successfully deleted the template ')
                                .hideDelay(3000)
                        );
                        RegisterTemplateService.resetModel();
                        StateService.FeedManager().Template().navigateToRegisteredTemplates();
                    }
                    else {
                        deleteTemplateError(response.data.message)
                    }
                }, function (response) {
                    deleteTemplateError(response.data.message)
                });

            }
        }

        /**
         * Displays a confirmation dialog for deleting the feed.
         */
        this.confirmDeleteTemplate = function () {
            var $dialogScope = $scope.$new();
            $dialogScope.dialog = $mdDialog;
            $dialogScope.vm = self;

            $mdDialog.show({
                escapeToClose: false,
                fullscreen: true,
                parent: angular.element(document.body),
                scope: $dialogScope,
                templateUrl: "js/feed-mgr/templates/template-stepper/select-template/template-delete-dialog.html"
            });
        };

        $scope.$watch(function(){
            return self.model.loading;
        },function(newVal){
            if(newVal == false) {
                hideProgress();
            }

        })


        this.getTemplates();

        AccessControlService.getUserAllowedActions()
            .then(function (actionSet) {
                self.allowEdit = AccessControlService.hasAction(AccessControlService.TEMPLATES_EDIT, actionSet.actions);
                self.allowAdmin = AccessControlService.hasAction(AccessControlService.TEMPLATES_ADMIN, actionSet.actions);
                self.allowExport = AccessControlService.hasAction(AccessControlService.TEMPLATES_EXPORT, actionSet.actions);
            });



    };

    angular.module(moduleName).controller('RegisterSelectTemplateController', ["$scope","$http","$mdDialog","$mdToast","$timeout","$q","RestUrlService","RegisterTemplateService","StateService","AccessControlService","EntityAccessControlService",controller]);

    angular.module(moduleName)
        .directive('thinkbigRegisterSelectTemplate', directive);





});