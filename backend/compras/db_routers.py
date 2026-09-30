class GastosRouter:
    """
    A router to control all database operations on models in the
    gastos system.
    """
    gastos_models = {'operaciones', 'operacioneshistorico', 'meses', 'categoriaresumen'}

    def db_for_read(self, model, **hints):
        if model._meta.model_name in self.gastos_models:
            return 'gastos_db'
        return 'default'

    def db_for_write(self, model, **hints):
        if model._meta.model_name in self.gastos_models:
            return 'gastos_db'
        return 'default'

    def allow_relation(self, obj1, obj2, **hints):
        if (
            obj1._meta.model_name in self.gastos_models or
            obj2._meta.model_name in self.gastos_models
        ):
           return True
        return None

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        if model_name in self.gastos_models:
            return db == 'gastos_db'
        return db == 'default'
