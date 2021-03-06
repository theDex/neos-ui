<?php
namespace Neos\Neos\Ui\View;

/*
 * This file is part of the Neos.Neos.Ui package.
 *
 * (c) Contributors of the Neos Project - www.neos.io
 *
 * This package is Open Source Software. For the full copyright and license
 * information, please view the LICENSE file which was distributed with this
 * source code.
 */

use Neos\Flow\Annotations as Flow;
use Neos\Fusion\View\FusionView;

class BackendFusionView extends FusionView
{
    public function __construct(array $options = array())
    {
        parent::__construct($options);
        $this->setFusionPathPattern('resource://Neos.Neos.Ui/Private/Fusion/Backend');
    }
}
