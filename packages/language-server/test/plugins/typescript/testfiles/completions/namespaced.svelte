<script lang="ts">
    import * as Components from './ComponentDef'
    import { ComponentDef3, ComponentDef6 } from './ComponentDef'

    const Components2 = {
        ComponentDef3, ComponentDef6
    }
</script>

<Components.ComponentDef3  hi={''} ></Components.ComponentDef3>
<Components2.ComponentDef3  hi={''} ></Components2.ComponentDef3>
<Components2.ComponentDef6  hi={''} ></Components2.ComponentDef6>
<Components.Namespace2.ComponentDef4  hi={''} ></Components.Namespace2.ComponentDef4>
<Components.Namespace2.ComponentDef7  hi4='' hi={''} ></Components.Namespace2.ComponentDef7>
