/*
 * Copyright 2020 Rundeck, Inc. (http://rundeck.com)
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
package org.rundeck.app.gui;

import java.util.Map;

/**
 * Handles link generation and redirect parameters for job list pages
 */
public interface JobListLinkHandler {
    /**
     *
     * @return The name that matches the value configured in the project property project.gui.job.list.default
     */
    String getName();

    /**
     *
     * @param redirectParams will be assigned to the 'params' attribute in the map generated by this method
     * @return a map that looks like [controller:'customjoblist',action:'listing_action',params: redirectParams]
     */
    Map generateRedirectMap(Map redirectParams);

    /**
     *
     * @param project The name of the project for the link
     * @return a relative link to the job list. e.g /project/myproject/jobs
     */
    String generateLinkToJobListAction(String project);
}
