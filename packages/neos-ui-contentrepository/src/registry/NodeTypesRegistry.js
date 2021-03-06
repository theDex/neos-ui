import {map} from 'ramda';
import {$get, $transform} from 'plow-js';
import {SynchronousRegistry} from '@neos-project/neos-ui-extensibility/src/registry';
import getNormalizedDeepStructureFromNodeType from './getNormalizedDeepStructureFromNodeType';

export default class NodeTypesRegistry extends SynchronousRegistry {
    _constraints = [];
    _inheritanceMap = [];
    _groups = [];
    _roles = [];

    _inspectorViewConfigurationCache = {};

    setConstraints(constraints) {
        this._constraints = constraints;
    }

    setInheritanceMap(inheritanceMap) {
        this._inheritanceMap = inheritanceMap;
    }

    setGroups(groups) {
        this._groups = groups;
    }

    setRoles(roles) {
        this._roles = roles;
    }

    getRole(roleName) {
        return this._roles[roleName];
    }

    hasRole(nodeTypeName, roleName) {
        return this.isOfType(nodeTypeName, this.getRole(roleName));
    }

    getAllowedChildNodeTypes(nodeTypeName) {
        const result = $get([nodeTypeName, 'nodeTypes'], this._constraints);

        return Object.keys(result || []).filter(key => result[key]);
    }

    getAllowedGrandChildNodeTypes(nodeTypeName, childNodeName) {
        const result = $get([nodeTypeName, 'childNodes', childNodeName, 'nodeTypes'], this._constraints);

        return Object.keys(result || []).filter(key => result[key]);
    }

    getAllowedNodeTypesTakingAutoCreatedIntoAccount(isSubjectNodeAutocreated, referenceParentName, referenceParentNodeType, referenceGrandParentNodeType, role) {
        let result;
        if (isSubjectNodeAutocreated) {
            if (!referenceGrandParentNodeType) {
                return [];
            }
            result = this.getAllowedGrandChildNodeTypes(referenceGrandParentNodeType, referenceParentName);
        } else {
            result = this.getAllowedChildNodeTypes(referenceParentNodeType);
        }

        // If role is provided, filter by role, e.g. only "content" or "document" ndoetypes
        return role ? result.filter(nodeTypeName => this.hasRole(nodeTypeName, role)) : result;
    }

    getNodeType(nodeTypeName) {
        return this.get(nodeTypeName);
    }

    getGroupedNodeTypeList(nodeTypeFilter) {
        const nodeTypesWrapped = nodeTypeFilter ? this._registry.filter(nodeType => {
            return nodeTypeFilter.indexOf(nodeType.value.name) !== -1;
        }) : this._registry;
        const nodeTypes = nodeTypesWrapped.map(item => item.value);

        // It's important to preserve the ordering of `this._groups` as we can't sort them again by position in JS (sorting logic is too complex)
        return Object.keys(this._groups).map(groupName => {
            // If a nodetype does not have group defined it means it's a system nodetype like "unstrctured"
            const nodesForGroup = nodeTypes
                // Filter by current group
                .filter(i => $get('ui.group', i) === groupName)
                // Sort nodetypes within group by position
                .sort((a, b) => $get('ui.position', a) > $get('ui.position', b) ? 1 : -1);

            if (nodesForGroup.length > 0) {
                const group = Object.assign({}, this._groups[groupName]);
                group.nodeTypes = nodesForGroup;
                group.name = groupName;
                return group;
            }
            return null;
        }).filter(i => i);
    }

    isOfType(nodeTypeName, referenceNodeTypeName) {
        if (nodeTypeName === referenceNodeTypeName) {
            return true;
        }

        return this._inheritanceMap.subTypes[referenceNodeTypeName].indexOf(nodeTypeName) !== -1;
    }

    getSubTypesOf(nodeTypeName) {
        return [nodeTypeName, ...this._inheritanceMap.subTypes[nodeTypeName]];
    }

    getInspectorViewConfigurationFor(nodeTypeName) {
        const nodeType = this.get(nodeTypeName);

        if (!nodeType) {
            return undefined;
        }

        if (this._inspectorViewConfigurationCache[nodeTypeName]) {
            return this._inspectorViewConfigurationCache[nodeTypeName];
        }

        const tabs = getNormalizedDeepStructureFromNodeType('ui.inspector.tabs')(nodeType);
        const groups = getNormalizedDeepStructureFromNodeType('ui.inspector.groups')(nodeType);
        const views = getNormalizedDeepStructureFromNodeType('ui.inspector.views')(nodeType);
        const properties = getNormalizedDeepStructureFromNodeType('properties')(nodeType);

        const viewConfiguration = {
            tabs: map(
                tab => ({
                    ...tab,
                    groups: map(
                        group => ({
                            ...group,
                            properties: map(
                                $transform({
                                    id: $get('id'),
                                    label: $get('ui.label'),
                                    editor: $get('ui.inspector.editor'),
                                    editorOptions: $get('ui.inspector.editorOptions')
                                }),
                                properties.filter(p => $get('ui.inspector.group', p) === group.id)
                            ),
                            views: map(
                                $transform({
                                    id: $get('id'),
                                    label: $get('label'),
                                    view: $get('view'),
                                    viewOptions: $get('viewOptions')
                                }),
                                views.filter(v => $get('group', v) === group.id)
                            )
                        }),
                        groups.filter(g => {
                            const isMatch = g.tab === tab.id;
                            const isDefaultTab = !g.tab && tab.id === 'default';

                            return isMatch || isDefaultTab;
                        })
                    )
                }),
                tabs
            )
        };

        this._inspectorViewConfigurationCache[nodeTypeName] = viewConfiguration;

        return viewConfiguration;
    }

    getInlineEditorIdentifierForProperty(nodeTypeName, propertyName) {
        const nodeType = this.get(nodeTypeName);

        //
        // TODO: Add documentation for this node type configuration, once it can be considered to be public API
        //
        return $get(['properties', propertyName, 'ui', 'inline', 'editor'], nodeType) || 'ckeditor';
    }

    /**
     * Inline Editor Configuration looks as follows:
     *
     * formatting: // what formatting is enabled / disabled
     *   b: true
     *   a: true
     *   MyFormattingRule: {Configuration Object if needed}
     * placeholder: "Placeholder text"
     * autoparagraph: true/false
     */
    getInlineEditorOptionsForProperty(nodeTypeName, propertyName) {
        const nodeType = this.get(nodeTypeName);

        const inlineEditorOptions = $get(['properties', propertyName, 'ui', 'inline', 'editorOptions'], nodeType);

        if (inlineEditorOptions) {
            return inlineEditorOptions;
        }

        // OLD variant of configuration
        const legacyConfiguration = $get(['properties', propertyName, 'ui', 'aloha'], nodeType);

        const convertedLegacyFormatting = [].concat(
            ...['format', 'link', 'list', 'table', 'alignment']
                .map(configurationKey => (legacyConfiguration && legacyConfiguration[configurationKey]) || [])
        ).reduce((acc, item) => {
            acc[item] = true;
            return acc;
        }, {});

        return {
            formatting: convertedLegacyFormatting,
            placeholder: $get('placeholder', legacyConfiguration),
            autoparagraph: $get('autoparagraph', legacyConfiguration)
        };
        //
        // TODO: Add documentation for this node type configuration, once it can be considered to be public API
        //
    }

    isInlineEditable(nodeTypeName) {
        const nodeType = this.get(nodeTypeName);

        if ($get('ui.inlineEditable', nodeType)) {
            return true;
        }

        const propertyDefinitions = $get('properties', nodeType);

        if (!propertyDefinitions) {
            return false;
        }

        return Object.keys(propertyDefinitions).some(
            propertyName => $get('ui.inlineEditable', propertyDefinitions[propertyName])
        );
    }
}
